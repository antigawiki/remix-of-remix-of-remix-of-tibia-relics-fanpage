import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, Loader2, SkipBack, SkipForward, MessageSquare, MessageSquareOff, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';

type PlayerState = 'idle' | 'loading-data' | 'ready' | 'loading-cam' | 'playing' | 'paused' | 'error';

interface TibiarcPlayerProps {
  className?: string;
  onStateChange?: (info: { camBuffer: Uint8Array | null; progress: number; isPlaying: boolean }) => void;
  onWasmVersion?: (version: string) => void;
  onFileNameChange?: (name: string) => void;
}

interface WasmModule {
  ccall: (name: string, returnType: string, argTypes: string[], args: any[]) => any;
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: any[]) => any;
  HEAPU8: Uint8Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
}

/** Safe wrapper for WASM ccall – swallows exceptions so the player keeps running */
const _warnedFns = new Set<string>();
function safeCall(mod: WasmModule, name: string, returnType: string, argTypes: string[], args: any[], fallback?: any): any {
  try {
    return mod.ccall(name, returnType, argTypes, args);
  } catch (e) {
    if (!_warnedFns.has(name)) {
      console.warn(`[TibiarcPlayer] WASM exception in ${name} (further suppressed):`, e);
      _warnedFns.add(name);
    }
    return fallback;
  }
}

/** Copy a Uint8Array into WASM heap, returning the pointer */
function copyToWasm(mod: WasmModule, data: Uint8Array): number {
  const ptr = mod._malloc(data.length);
  mod.HEAPU8.set(data, ptr);
  return ptr;
}

/**
 * Check if the canvas is mostly black (corrupted state).
 * Samples pixels in a grid pattern for performance.
 * Returns true if >90% of sampled pixels are near-black.
 */
function isCanvasBlack(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return false;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Sample ~100 pixels in a grid
    const stepX = Math.max(1, Math.floor(w / 10));
    const stepY = Math.max(1, Math.floor(h / 10));
    let totalSampled = 0;
    let blackCount = 0;
    const BLACK_THRESHOLD = 15; // RGB values below this are considered "black"

    for (let y = stepY; y < h - stepY; y += stepY) {
      for (let x = stepX; x < w - stepX; x += stepX) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        totalSampled++;
        if (r < BLACK_THRESHOLD && g < BLACK_THRESHOLD && b < BLACK_THRESHOLD) {
          blackCount++;
        }
      }
    }

    if (totalSampled === 0) return false;
    const blackRatio = blackCount / totalSampled;
    return blackRatio > 0.9;
  } catch {
    return false;
  }
}

const TibiarcPlayer = ({ className, onStateChange, onWasmVersion, onFileNameChange }: TibiarcPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const moduleRef = useRef<WasmModule | null>(null);
  const pollingRef = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const seekDebounceRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const camBufferRef = useRef<Uint8Array | null>(null);
  const lastGoodProgressRef = useRef(0);
  const blackCheckCountRef = useRef(0); // consecutive black checks during playback
  const autoSkippingRef = useRef(false); // prevent re-entrant auto-skip
  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(1);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const overlayEnabledRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Sync fullscreen state when user exits via ESC
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        setControlsVisible(true);
        resetHideTimer();
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (isFullscreen) resetHideTimer();
  }, [isFullscreen, resetHideTimer]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Load WASM module + data files on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setState('loading-data');
      try {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).TibiarcModule) { resolve(); return; }
          const script = document.createElement('script');
          script.src = '/tibiarc/tibiarc_player.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load tibiarc WASM script'));
          document.head.appendChild(script);
        });

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Fetch WASM info for version badge
        onWasmVersion?.('V50');

        const TibiarcModuleFactory = (window as any).TibiarcModule;
        const mod: WasmModule = await TibiarcModuleFactory({
          canvas,
          locateFile: (path: string) => {
            if (path.endsWith('.wasm')) return '/tibiarc/tibiarc_player.wasm';
            return `/tibiarc/${path}`;
          },
          webglContextAttributes: { preserveDrawingBuffer: true },
        });

        if (cancelled) return;
        moduleRef.current = mod;

        const [picRes, sprRes, datRes] = await Promise.all([
          fetch('/tibiarc/data/Tibia.pic'),
          fetch('/tibiarc/data/Tibia.spr'),
          fetch('/tibiarc/data/Tibia.dat'),
        ]);
        if (!picRes.ok || !sprRes.ok || !datRes.ok) throw new Error('Tibia data files not found');
        const [picBuf, sprBuf, datBuf] = await Promise.all([
          picRes.arrayBuffer(),
          sprRes.arrayBuffer(),
          datRes.arrayBuffer(),
        ]);
        if (cancelled) return;

        const picData = new Uint8Array(picBuf);
        const sprData = new Uint8Array(sprBuf);
        const datData = new Uint8Array(datBuf);

        const picPtr = copyToWasm(mod, picData);
        const sprPtr = copyToWasm(mod, sprData);
        const datPtr = copyToWasm(mod, datData);

        const result = safeCall(mod, 'load_data_files', 'number',
          ['number', 'number', 'number', 'number', 'number', 'number'],
          [picPtr, picData.length, sprPtr, sprData.length, datPtr, datData.length], 0);

        mod._free(picPtr);
        mod._free(sprPtr);
        mod._free(datPtr);

        if (result !== 1) throw new Error('Failed to initialize tibiarc data files');

        setDataLoaded(true);
        setState('idle');
        console.log('[TibiarcPlayer] WASM module + data files loaded');
      } catch (err) {
        if (cancelled) return;
        console.error('[TibiarcPlayer] Init failed:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load WASM');
        setState('error');
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  // Progress polling with black-screen detection for auto-skip
  useEffect(() => {
    if (state === 'playing') {
      let tickCount = 0;
      pollingRef.current = window.setInterval(() => {
        if (seekingRef.current || autoSkippingRef.current) return;
        const mod = moduleRef.current;
        if (!mod) return;

        const p = safeCall(mod, 'get_progress', 'number', [], [], 0);
        const playing = safeCall(mod, 'is_playing', 'number', [], [], 1);
        setProgress(p);
        if (p > 0) lastGoodProgressRef.current = p;
        onStateChange?.({ camBuffer: camBufferRef.current, progress: p, isPlaying: !!playing });
        

        if (!playing) {
          setState('paused');
          setProgress(safeCall(mod, 'get_duration', 'number', [], [], 0));
          blackCheckCountRef.current = 0;
          return;
        }

        // Every ~2s (20 ticks * 100ms), check for black screen
        tickCount++;
        if (tickCount % 20 === 0) {
          const canvas = canvasRef.current;
          if (canvas && isCanvasBlack(canvas)) {
            blackCheckCountRef.current++;
            // Require 2 consecutive black checks to avoid false positives
            if (blackCheckCountRef.current >= 2) {
              console.warn(`[TibiarcPlayer] Black screen detected at ${p}ms during playback, auto-skipping +5s`);
              autoSkippingRef.current = true;
              blackCheckCountRef.current = 0;

              safeCall(mod, 'pause_playback', 'undefined', [], []);
              const skipTarget = Math.min(p + 5000, duration);
              const reloaded = reloadRecording(mod);
              if (reloaded) {
                safeCall(mod, 'seek', 'undefined', ['number'], [skipTarget]);
                setProgress(skipTarget);
                lastGoodProgressRef.current = skipTarget;
              }
              safeCall(mod, 'play', 'undefined', [], []);
              autoSkippingRef.current = false;
            }
          } else {
            blackCheckCountRef.current = 0;
          }
        }
      }, 100);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [state, duration, onStateChange]);

  // Visibilitychange handler
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && state === 'playing') {
        const mod = moduleRef.current;
        if (mod) {
          safeCall(mod, 'pause_playback', 'undefined', [], []);
          safeCall(mod, 'play', 'undefined', [], []);
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [state]);

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (ext !== '.cam') {
      setErrorMsg(t('camPlayer.invalidFormat'));
      setState('error');
      return;
    }

    const mod = moduleRef.current;
    if (!mod) return;

    setFileName(file.name);
    onFileNameChange?.(file.name);
    setErrorMsg('');
    setState('loading-cam');

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      camBufferRef.current = data;

      const bufPtr = copyToWasm(mod, data);

      const dur = safeCall(mod, 'load_recording_tibiarelic', 'number',
        ['number', 'number', 'number', 'number', 'number'],
        [bufPtr, data.length, 7, 72, 0], -1);

      mod._free(bufPtr);

      if (dur === -1) {
        setErrorMsg('Versão do .cam não detectada');
        setState('error');
        return;
      }
      if (dur === 0) {
        setErrorMsg(t('camPlayer.loadError'));
        setState('error');
        return;
      }

      setDuration(dur);
      setProgress(0);
      lastGoodProgressRef.current = 0;
      blackCheckCountRef.current = 0;

      // Apply current overlay state after loading
      safeCall(mod, 'set_skip_messages', 'undefined', ['number'], [overlayEnabledRef.current ? 0 : 1]);

      // Auto-play
      safeCall(mod, 'play', 'undefined', [], []);
      setState('playing');

      console.log(`[TibiarcPlayer] Loaded ${file.name}: ${(dur / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error('Failed to load .cam:', err);
      setErrorMsg(err instanceof Error ? err.message : t('camPlayer.loadError'));
      setState('error');
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const togglePlayback = () => {
    const mod = moduleRef.current;
    if (!mod) return;

    if (state === 'paused') {
      safeCall(mod, 'play', 'undefined', [], []);
      setState('playing');
    } else if (state === 'playing') {
      safeCall(mod, 'pause_playback', 'undefined', [], []);
      setState('paused');
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 2, 4, 8];
    const currentIndex = speeds.indexOf(speed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(newSpeed);
    const mod = moduleRef.current;
    if (mod) {
      safeCall(mod, 'set_speed', 'undefined', ['number'], [newSpeed]);
    }
  };

  /** Reload the .cam recording from cached buffer */
  const reloadRecording = useCallback((mod: WasmModule): boolean => {
    const data = camBufferRef.current;
    if (!data) return false;
    const bufPtr = copyToWasm(mod, data);
    const dur = safeCall(mod, 'load_recording_tibiarelic', 'number',
      ['number', 'number', 'number', 'number', 'number'],
      [bufPtr, data.length, 7, 72, 0], -1);
    mod._free(bufPtr);
    if (dur > 0) {
      // Re-apply overlay state after reload (WASM resets g_skip_messages)
      safeCall(mod, 'set_skip_messages', 'undefined', ['number'], [overlayEnabledRef.current ? 0 : 1]);
      return true;
    }
    return false;
  }, []);

  /**
   * Seek with black-screen detection and auto-skip.
   * After seeking, waits briefly for render then checks if canvas is black.
   * If black, tries increasingly large forward offsets to skip corrupted frames.
   */
  const handleSeek = (val: number[]) => {
    const ms = val[0];
    setProgress(ms);
    setProgress(ms);

    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekingRef.current = true;

    seekDebounceRef.current = window.setTimeout(() => {
      const mod = moduleRef.current;
      if (!mod) { seekingRef.current = false; return; }

      const wasPlaying = state === 'playing';
      if (wasPlaying) safeCall(mod, 'pause_playback', 'undefined', [], []);

      // Always reload recording for a clean gamestate before seeking
      const reloaded = reloadRecording(mod);
      if (!reloaded) {
        console.error('[TibiarcPlayer] Failed to reload recording for seek');
        seekingRef.current = false;
        return;
      }

      safeCall(mod, 'seek', 'undefined', ['number'], [ms]);
      lastGoodProgressRef.current = ms;
      setProgress(ms);

      // After seek, wait for render then validate canvas
      const canvas = canvasRef.current;
      if (canvas) {
        setTimeout(() => {
          if (isCanvasBlack(canvas)) {
            console.warn(`[TibiarcPlayer] Black screen after seek to ${ms}ms, trying skip offsets`);
            const offsets = [5000, 15000, 30000];
            let recovered = false;

            for (const offset of offsets) {
              const target = Math.min(ms + offset, duration);
              if (target === ms) continue; // don't retry same position

              const ok = reloadRecording(mod);
              if (!ok) break;

              safeCall(mod, 'seek', 'undefined', ['number'], [target]);

              // Synchronous check — the WASM renders to the canvas during seek
              if (!isCanvasBlack(canvas)) {
                console.info(`[TibiarcPlayer] Recovered by skipping to ${target}ms (+${offset / 1000}s)`);
                lastGoodProgressRef.current = target;
                setProgress(target);
                recovered = true;
                break;
              }
            }

            if (!recovered) {
              // All offsets failed — restore to last known good position
              console.warn('[TibiarcPlayer] All skip offsets failed, restoring last good position');
              const ok = reloadRecording(mod);
              if (ok) {
                safeCall(mod, 'seek', 'undefined', ['number'], [lastGoodProgressRef.current]);
                setProgress(lastGoodProgressRef.current);
              }
            }
          }

          if (wasPlaying) {
            safeCall(mod, 'play', 'undefined', [], []);
          }
          seekingRef.current = false;
        }, 80); // wait for WASM to render a frame
      } else {
        if (wasPlaying) safeCall(mod, 'play', 'undefined', [], []);
        seekingRef.current = false;
      }
    }, 150);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const isLoading = state === 'loading-data' || state === 'loading-cam';
  const hasRecording = state === 'playing' || state === 'paused';

  // Controls component used in both normal and fullscreen modes
  const renderControls = (overlay?: boolean) => (
    <div className={overlay
      ? `absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-4 py-3 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
      : 'space-y-3'
    }>
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground min-w-[40px]">
          {formatTime(progress)}
        </span>
        <Slider
          value={[progress]}
          onValueChange={handleSeek}
          max={duration || 100}
          step={1000}
          className="flex-1"
          disabled={!hasRecording}
        />
        <span className="text-xs text-muted-foreground min-w-[40px] text-right">
          {formatTime(duration)}
        </span>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={togglePlayback} disabled={!hasRecording} className="border-border/50">
            {state === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleSeek([Math.max(0, progress - 10000)])} disabled={!hasRecording} className="border-border/50" title="-10s">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleSeek([Math.min(duration, progress + 10000)])} disabled={!hasRecording} className="border-border/50" title="+10s">
            <SkipForward className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={cycleSpeed} disabled={!hasRecording} className="border-border/50 min-w-[60px]">
            <FastForward className="w-3 h-3 mr-1" />
            {speed}x
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const next = !overlayEnabled;
              setOverlayEnabled(next);
              overlayEnabledRef.current = next;
              const mod = moduleRef.current;
              if (mod) safeCall(mod, 'set_skip_messages', 'undefined', ['number'], [next ? 0 : 1]);
            }}
            disabled={!hasRecording}
            className="border-border/50"
            title={overlayEnabled ? 'Esconder mensagens' : 'Mostrar mensagens'}
          >
            {overlayEnabled ? <MessageSquare className="w-4 h-4" /> : <MessageSquareOff className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullscreen} disabled={!hasRecording} className="border-border/50" title={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasRecording && !overlay && (
            <Button variant="outline" size="sm" className="border-border/50" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1" />
              Outra .cam
            </Button>
          )}
          {!overlay && (
            <span className="text-sm text-muted-foreground">
              {state === 'idle' && !dataLoaded && 'Inicializando...'}
              {state === 'idle' && dataLoaded && t('camPlayer.noFileLoaded')}
              {isLoading && t('common.loading')}
              {state === 'playing' && t('camPlayer.playing')}
              {state === 'paused' && t('camPlayer.paused')}
              {state === 'error' && t('camPlayer.loadError')}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Main container – goes fullscreen */}
      <div
        ref={containerRef}
        className={`relative ${isFullscreen ? 'bg-black flex items-center justify-center w-screen h-screen' : 'w-full max-w-[960px] mx-auto'}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onMouseMove={handleMouseMove}
      >
        {/* Canvas wrapper with aspect ratio */}
        <div className={`relative ${isFullscreen ? 'w-full h-full flex items-center justify-center' : 'aspect-[480/352] bg-black rounded-sm overflow-hidden border-2 border-border/50'}`}>
          <canvas
            ref={canvasRef}
            id="canvas"
            width={480}
            height={352}
            className={isFullscreen
              ? 'max-w-full max-h-full object-contain'
              : 'w-full h-full'
            }
            style={{
              imageRendering: 'auto',
              ...(isFullscreen ? { aspectRatio: '480/352' } : {}),
            }}
          />


          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".cam"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              if (e.target) e.target.value = '';
            }}
          />

          {/* Idle overlay */}
          {(state === 'idle' || state === 'error') && dataLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
              <Upload className="w-12 h-12 text-gold/60" />
              <div className="text-center space-y-2">
                <p className="text-gold font-heading text-lg">{t('camPlayer.dropFile')}</p>
                <p className="text-muted-foreground text-sm">Formatos suportados: .cam (TibiaRelic)</p>
                {errorMsg && <p className="text-destructive text-sm mt-2">{errorMsg}</p>}
              </div>
              <Button variant="outline" className="mt-2 border-gold/50 text-gold hover:bg-gold/10" onClick={() => fileInputRef.current?.click()}>
                {t('camPlayer.selectFile')}
              </Button>
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <p className="text-gold text-sm">
                {state === 'loading-data' ? 'Carregando WASM e sprites...' : `Carregando ${fileName}...`}
              </p>
            </div>
          )}

          {/* File name indicator when playing */}
          {hasRecording && (
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-gold/80">
              {fileName}
            </div>
          )}
        </div>

        {/* Fullscreen overlay controls */}
        {isFullscreen && hasRecording && renderControls(true)}
      </div>

      {/* Normal controls (outside fullscreen) */}
      {!isFullscreen && (
        <div className="max-w-[960px] mx-auto w-full">
          {renderControls(false)}
        </div>
      )}
    </div>
  );
};

export default TibiarcPlayer;
