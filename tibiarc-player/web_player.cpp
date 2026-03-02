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
#include "parser.hpp"
#include "demuxer.hpp"

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
static void FastForwardToPlayer();

// --- Helper: fast-forward until player is initialized ---
static void FastForwardToPlayer() {
    while (!g_gamestate->Creatures.contains(g_gamestate->Player.Id) &&
           g_needle != g_recording->Frames.cend()) {
        for (auto &event : g_needle->Events) {
            event->Update(*g_gamestate);
        }
        g_needle = std::next(g_needle);
    }
}

// --- Little-endian helpers ---
static uint16_t read_u16_le(const uint8_t *p) {
    return (uint16_t)p[0] | ((uint16_t)p[1] << 8);
}

static uint32_t read_u32_le(const uint8_t *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
           ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

static uint64_t read_u64_le(const uint8_t *p) {
    return (uint64_t)read_u32_le(p) | ((uint64_t)read_u32_le(p + 4) << 32);
}

static float read_f32_le(const uint8_t *p) {
    float f;
    memcpy(&f, p, 4);
    return f;
}

// --- Exported JS functions ---
extern "C" {

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
    // Forward to version-based loader with auto-detect
    try {
        if (g_picData.empty() || g_sprData.empty() || g_datData.empty()) {
            printf("[tibiarc] Data files not loaded yet\n");
            return 0;
        }

        DataReader reader(len, buf);
        auto format = Recordings::GuessFormat(filename, reader);

        VersionTriplet triplet;
        if (!Recordings::QueryTibiaVersion(format, reader, triplet)) {
            printf("[tibiarc] Could not determine recording version.\n");
            return -1;
        }

        DataReader picReader(g_picData.size(), g_picData.data());
        DataReader sprReader(g_sprData.size(), g_sprData.data());
        DataReader datReader(g_datData.size(), g_datData.data());
        g_version = std::make_unique<Version>(triplet, picReader, sprReader, datReader);

        DataReader reader2(len, buf);
        auto [recording, partial] = Recordings::Read(
            format, reader2, *g_version, Recordings::Recovery::None);

        if (partial) printf("[tibiarc] Warning: Recording is partial\n");

        g_recording = std::move(recording);
        g_gamestate = std::make_unique<Gamestate>(*g_version);
        g_needle = g_recording->Frames.cbegin();
        g_currentTick = std::chrono::milliseconds::zero();
        g_playing = false;

        FastForwardToPlayer();
        RenderFrame();

        printf("[tibiarc] Recording loaded: %lld ms, %zu frames\n",
               g_recording->Runtime.count(), g_recording->Frames.size());
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
int load_recording_tibiarelic(const uint8_t *buf, int len,
                               int ver_major, int ver_minor, int ver_patch) {
    try {
        if (g_picData.empty() || g_sprData.empty() || g_datData.empty()) {
            printf("[tibiarc] Data files not loaded yet\n");
            return 0;
        }

        if (len < 12) {
            printf("[tibiarc] TibiaRelic file too small (%d bytes)\n", len);
            return 0;
        }

        // 1. Parse TibiaRelic header (12 bytes)
        uint32_t fileVersion = read_u32_le(buf);
        float fps = read_f32_le(buf + 4);
        // bytes 8-11: extra/reserved
        int pos = 12;

        printf("[tibiarc] TibiaRelic header: version=%u fps=%.1f\n", fileVersion, fps);

        // 2. Create Version with Tibia data files
        VersionTriplet triplet(ver_major, ver_minor, ver_patch);
        DataReader picReader(g_picData.size(), g_picData.data());
        DataReader sprReader(g_sprData.size(), g_sprData.data());
        DataReader datReader(g_datData.size(), g_datData.data());
        g_version = std::make_unique<Version>(triplet, picReader, sprReader, datReader);

        printf("[tibiarc] Using Tibia version: %d.%d.%d\n", ver_major, ver_minor, ver_patch);

        // 3. Parse frames using Parser + Demuxer
        Parser parser(*g_version, false);
        Demuxer demuxer(2);  // TCP-style 2-byte length header
        auto recording = std::make_unique<Recordings::Recording>();

        uint64_t ts0 = 0;
        bool first = true;
        int frameCount = 0;

        while (pos + 10 <= len) {
            uint64_t ts = read_u64_le(buf + pos);
            uint16_t sz = read_u16_le(buf + pos + 8);
            pos += 10;

            if (sz == 0 || pos + sz > len) break;

            if (first) { ts0 = ts; first = false; }

            auto timestamp = std::chrono::milliseconds((int64_t)(ts - ts0));
            DataReader fragment(sz, buf + pos);

            demuxer.Submit(timestamp, fragment,
                [&](DataReader packetReader, std::chrono::milliseconds pktTs) {
                    auto events = parser.Parse(packetReader);
                    if (!events.empty()) {
                        recording->Frames.emplace_back(pktTs, std::move(events));
                    }
                });

            pos += sz;
            frameCount++;
        }

        demuxer.Finish([&](DataReader packetReader, std::chrono::milliseconds pktTs) {
            auto events = parser.Parse(packetReader);
            if (!events.empty()) {
                recording->Frames.emplace_back(pktTs, std::move(events));
            }
        });

        if (recording->Frames.empty()) {
            printf("[tibiarc] No frames parsed from TibiaRelic file\n");
            return 0;
        }

        // 4. Set runtime
        recording->Runtime = recording->Frames.back().Timestamp;

        printf("[tibiarc] TibiaRelic parsed: %d raw frames -> %zu game frames, %lld ms\n",
               frameCount, recording->Frames.size(), recording->Runtime.count());

        g_recording = std::move(recording);
        g_gamestate = std::make_unique<Gamestate>(*g_version);
        g_needle = g_recording->Frames.cbegin();
        g_currentTick = std::chrono::milliseconds::zero();
        g_playing = false;

        // 5. Fast-forward until player initialized
        FastForwardToPlayer();
        RenderFrame();

        return (int)(g_recording->Runtime.count());
    } catch (const std::exception &e) {
        printf("[tibiarc] TibiaRelic error: %s\n", e.what());
        return 0;
    } catch (...) {
        printf("[tibiarc] Unknown error loading TibiaRelic recording\n");
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

        FastForwardToPlayer();
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

    Renderer::Options options{
        .Width = RENDER_WIDTH,
        .Height = RENDER_HEIGHT - 128
    };

    Canvas mapCanvas(Renderer::NativeResolutionX, Renderer::NativeResolutionY);
    mapCanvas.DrawRectangle(Pixel(0, 0, 0), 0, 0,
                            Renderer::NativeResolutionX,
                            Renderer::NativeResolutionY);

    Renderer::DrawGamestate(options, *g_gamestate, mapCanvas);

    Canvas outputCanvas(RENDER_WIDTH, RENDER_HEIGHT);
    Renderer::DrawClientBackground(*g_gamestate, outputCanvas,
                                   0, 0, RENDER_WIDTH, RENDER_HEIGHT);

    for (int y = 0; y < std::min(mapCanvas.Height, outputCanvas.Height); y++) {
        for (int x = 0; x < std::min(mapCanvas.Width, outputCanvas.Width); x++) {
            outputCanvas.GetPixel(x, y) = mapCanvas.GetPixel(x, y);
        }
    }

    Renderer::DrawOverlay(options, *g_gamestate, outputCanvas);

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

    if (g_currentTick >= g_recording->Runtime) {
        g_playing = false;
        g_currentTick = g_recording->Runtime;
        return;
    }

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
