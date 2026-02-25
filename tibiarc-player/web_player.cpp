/*
 * Minimal tibiarc web player - SDL2 + Emscripten
 * Renders .cam recordings to HTML5 Canvas via WebAssembly.
 *
 * Licensed under AGPL-3.0 (same as tibiarc)
 */

#include <SDL2/SDL.h>
#include <emscripten.h>
#include <emscripten/html5.h>

#include "renderer.hpp"
#include "recordings.hpp"
#include "versions.hpp"
#include "gamestate.hpp"
#include "canvas.hpp"
#include "datareader.hpp"

#include <memory>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <vector>
#include <algorithm>

using namespace trc;

// --- Global state ---
static SDL_Window *g_window = nullptr;
static SDL_Renderer *g_renderer = nullptr;
static SDL_Texture *g_texture = nullptr;

static std::unique_ptr<Version> g_version;
static std::unique_ptr<Recordings::Recording> g_recording;
static std::unique_ptr<Gamestate> g_gamestate;

static std::list<Recordings::Recording::Frame>::const_iterator g_needle;

static bool g_playing = false;
static double g_speed = 1.0;
static std::chrono::milliseconds g_currentTick{0};
static double g_lastFrameTime = 0;

static const int RENDER_WIDTH = 640;
static const int RENDER_HEIGHT = 480;

// Data file buffers (kept alive for the Version object)
static std::vector<uint8_t> g_picData;
static std::vector<uint8_t> g_sprData;
static std::vector<uint8_t> g_datData;

// --- Forward declarations ---
static void RenderFrame();
static void MainLoop();

// --- Exported JS functions ---
extern "C" {

// Forward declare so load_recording can call it
int load_recording_with_version(const uint8_t *buf, int len, const char *filename,
                                 int ver_major, int ver_minor, int ver_patch);

EMSCRIPTEN_KEEPALIVE
int load_data_files(const uint8_t *picBuf, int picLen,
                    const uint8_t *sprBuf, int sprLen,
                    const uint8_t *datBuf, int datLen) {
    try {
        g_picData.assign(picBuf, picBuf + picLen);
        g_sprData.assign(sprBuf, sprBuf + sprLen);
        g_datData.assign(datBuf, datBuf + datLen);

        printf("[tibiarc] Data files loaded: pic=%d spr=%d dat=%d bytes\n",
               picLen, sprLen, datLen);
        return 1;
    } catch (...) {
        printf("[tibiarc] Error loading data files\n");
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE
int load_recording(const uint8_t *buf, int len, const char *filename) {
    return load_recording_with_version(buf, len, filename, 0, 0, 0);
}

EMSCRIPTEN_KEEPALIVE
int load_recording_with_version(const uint8_t *buf, int len, const char *filename,
                                 int ver_major, int ver_minor, int ver_patch) {
    try {
        if (g_picData.empty() || g_sprData.empty() || g_datData.empty()) {
            printf("[tibiarc] Data files not loaded yet\n");
            return 0;
        }

        DataReader reader(len, buf);

        // Guess format from filename
        auto format = Recordings::GuessFormat(filename, reader);

        VersionTriplet triplet;
        bool hasManualVersion = (ver_major > 0);

        if (hasManualVersion) {
            triplet = VersionTriplet(ver_major, ver_minor, ver_patch);
            printf("[tibiarc] Using manual version: %d.%d.%d\n",
                   ver_major, ver_minor, ver_patch);
        } else {
            // Try to auto-detect version from the recording
            if (!Recordings::QueryTibiaVersion(format, reader, triplet)) {
                printf("[tibiarc] Could not determine recording version. "
                       "Please specify the version manually.\n");
                return -1;  // -1 = version detection failed
            }
            printf("[tibiarc] Detected version: %s\n",
                   static_cast<std::string>(triplet).c_str());
        }

        // Create version with data files
        DataReader picReader(g_picData.size(), g_picData.data());
        DataReader sprReader(g_sprData.size(), g_sprData.data());
        DataReader datReader(g_datData.size(), g_datData.data());

        g_version = std::make_unique<Version>(triplet, picReader, sprReader, datReader);

        // Re-create reader since GuessFormat/QueryTibiaVersion may have consumed it
        DataReader reader2(len, buf);
        auto [recording, partial] = Recordings::Read(
            format, reader2, *g_version, Recordings::Recovery::None);

        if (partial) {
            printf("[tibiarc] Warning: Recording is partial\n");
        }

        g_recording = std::move(recording);
        g_gamestate = std::make_unique<Gamestate>(*g_version);

        // Initialize
        g_needle = g_recording->Frames.cbegin();
        g_currentTick = std::chrono::milliseconds::zero();
        g_playing = false;

        // Fast-forward until player is initialized
        while (!g_gamestate->Creatures.contains(g_gamestate->Player.Id) &&
               g_needle != g_recording->Frames.cend()) {
            for (auto &event : g_needle->Events) {
                event->Update(*g_gamestate);
            }
            g_needle = std::next(g_needle);
        }

        printf("[tibiarc] Recording loaded: %lld ms runtime, %zu frames\n",
               g_recording->Runtime.count(),
               g_recording->Frames.size());

        // Render first frame
        RenderFrame();

        return (int)(g_recording->Runtime.count());
    } catch (const std::exception &e) {
        printf("[tibiarc] Error: %s\n", e.what());
        return 0;
    } catch (...) {
        printf("[tibiarc] Unknown error loading recording\n");
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE
void play() {
    if (g_recording && !g_playing) {
        g_playing = true;
        g_lastFrameTime = emscripten_get_now();
    }
}

EMSCRIPTEN_KEEPALIVE
void pause_playback() {
    g_playing = false;
}

EMSCRIPTEN_KEEPALIVE
void set_speed(double speed) {
    g_speed = std::max(0.25, std::min(speed, 16.0));
}

EMSCRIPTEN_KEEPALIVE
double get_progress() {
    if (!g_recording) return 0;
    return (double)g_currentTick.count();
}

EMSCRIPTEN_KEEPALIVE
double get_duration() {
    if (!g_recording) return 0;
    return (double)g_recording->Runtime.count();
}

EMSCRIPTEN_KEEPALIVE
void seek(double ms) {
    if (!g_recording || !g_gamestate) return;

    auto target = std::chrono::milliseconds((int64_t)ms);

    if (target < g_currentTick) {
        // Need to replay from start
        g_gamestate->Reset();
        g_needle = g_recording->Frames.cbegin();
        g_currentTick = std::chrono::milliseconds::zero();

        // Fast-forward player init
        while (!g_gamestate->Creatures.contains(g_gamestate->Player.Id) &&
               g_needle != g_recording->Frames.cend()) {
            for (auto &event : g_needle->Events) {
                event->Update(*g_gamestate);
            }
            g_needle = std::next(g_needle);
        }
    }

    // Fast-forward to target
    while (g_needle != g_recording->Frames.cend() &&
           g_needle->Timestamp <= target) {
        for (auto &event : g_needle->Events) {
            event->Update(*g_gamestate);
        }
        g_needle = std::next(g_needle);
    }

    g_currentTick = target;
    g_gamestate->CurrentTick = target.count();
    RenderFrame();
}

EMSCRIPTEN_KEEPALIVE
int is_playing() {
    return g_playing ? 1 : 0;
}

} // extern "C"

static void RenderFrame() {
    if (!g_gamestate || !g_recording) return;

    // Render to tibiarc canvas
    Renderer::Options options{
        .Width = RENDER_WIDTH,
        .Height = RENDER_HEIGHT - 128  // Leave space for interface
    };

    Canvas mapCanvas(Renderer::NativeResolutionX, Renderer::NativeResolutionY);
    mapCanvas.DrawRectangle(Pixel(0, 0, 0), 0, 0,
                            Renderer::NativeResolutionX,
                            Renderer::NativeResolutionY);

    Renderer::DrawGamestate(options, *g_gamestate, mapCanvas);

    // Create output canvas matching SDL texture
    Canvas outputCanvas(RENDER_WIDTH, RENDER_HEIGHT);
    Renderer::DrawClientBackground(*g_gamestate, outputCanvas,
                                   0, 0, RENDER_WIDTH, RENDER_HEIGHT);

    // Copy map to output (simple blit for now)
    for (int y = 0; y < std::min(mapCanvas.Height, outputCanvas.Height); y++) {
        for (int x = 0; x < std::min(mapCanvas.Width, outputCanvas.Width); x++) {
            outputCanvas.GetPixel(x, y) = mapCanvas.GetPixel(x, y);
        }
    }

    Renderer::DrawOverlay(options, *g_gamestate, outputCanvas);

    // Update SDL texture
    SDL_UpdateTexture(g_texture, nullptr, outputCanvas.Buffer, outputCanvas.Stride);
    SDL_RenderClear(g_renderer);
    SDL_RenderCopy(g_renderer, g_texture, nullptr, nullptr);
    SDL_RenderPresent(g_renderer);
}

static void MainLoop() {
    if (!g_playing || !g_recording || !g_gamestate) {
        return;
    }

    double now = emscripten_get_now();
    double elapsed = (now - g_lastFrameTime) * g_speed;
    g_lastFrameTime = now;

    g_currentTick += std::chrono::milliseconds((int64_t)elapsed);
    g_gamestate->CurrentTick = g_currentTick.count();

    // Check if playback is done
    if (g_currentTick >= g_recording->Runtime) {
        g_playing = false;
        g_currentTick = g_recording->Runtime;
        return;
    }

    // Process events up to current tick
    while (g_needle != g_recording->Frames.cend() &&
           g_needle->Timestamp <= g_currentTick) {
        for (auto &event : g_needle->Events) {
            event->Update(*g_gamestate);
        }
        g_needle = std::next(g_needle);
    }

    g_gamestate->Messages.Prune(g_currentTick.count());
    RenderFrame();
}

int main() {
    SDL_Init(SDL_INIT_VIDEO);

    g_window = SDL_CreateWindow("tibiarc",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        RENDER_WIDTH, RENDER_HEIGHT, 0);
    g_renderer = SDL_CreateRenderer(g_window, -1, SDL_RENDERER_ACCELERATED);
    g_texture = SDL_CreateTexture(g_renderer, SDL_PIXELFORMAT_RGBA8888,
        SDL_TEXTUREACCESS_STREAMING, RENDER_WIDTH, RENDER_HEIGHT);

    SDL_SetRenderDrawColor(g_renderer, 0, 0, 0, 255);
    SDL_RenderClear(g_renderer);
    SDL_RenderPresent(g_renderer);

    emscripten_set_main_loop(MainLoop, 0, 0);

    return 0;
}
