import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, Loader2, SkipBack, SkipForward, MessageSquare, MessageSquareOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';

type PlayerState = 'idle' | 'loading-data' | 'ready' | 'loading-cam' | 'playing' | 'paused' | 'error';

interface TibiarcPlayerProps {
  className?: string;
}

interface WasmModule {
  ccall: (name: string, returnType: string, argTypes: string[], args: any[]) => any;
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: any[]) => any;
  HEAPU8: Uint8Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
}

/** Copy a Uint8Array into WASM heap, returning the pointer */
function copyToWasm(mod: WasmModule, data: Uint8Array): number {
  const ptr = mod._malloc(data.length);
  mod.HEAPU8.set(data, ptr);
  return ptr;
}

/** Copy a string into WASM heap as null-terminated UTF-8 */
function copyStringToWasm(mod: WasmModule, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str + '\0');
  const ptr = mod._malloc(bytes.length);
  mod.HEAPU8.set(bytes, ptr);
  return ptr;
}

const TibiarcPlayer = ({ className }: TibiarcPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const moduleRef = useRef<WasmModule | null>(null);
  const pollingRef = useRef<number | null>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(1);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);

  // Load WASM module + data files on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setState('loading-data');
      try {
        // Load the Emscripten module script
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

        // Instantiate the WASM module with our canvas
        const TibiarcModuleFactory = (window as any).TibiarcModule;
        const mod: WasmModule = await TibiarcModuleFactory({
          canvas,
          locateFile: (path: string) => {
            // The compiled JS may reference the original wasm filename
            if (path.endsWith('.wasm')) return '/tibiarc/tibiarc_player.wasm';
            return `/tibiarc/${path}`;
          },
        });

        if (cancelled) return;
        moduleRef.current = mod;

        // Fetch data files
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

        // Copy to WASM and call load_data_files
        const picData = new Uint8Array(picBuf);
        const sprData = new Uint8Array(sprBuf);
        const datData = new Uint8Array(datBuf);

        const picPtr = copyToWasm(mod, picData);
        const sprPtr = copyToWasm(mod, sprData);
        const datPtr = copyToWasm(mod, datData);

        const result = mod.ccall('load_data_files', 'number',
          ['number', 'number', 'number', 'number', 'number', 'number'],
          [picPtr, picData.length, sprPtr, sprData.length, datPtr, datData.length]);

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

  // Progress polling
  useEffect(() => {
    if (state === 'playing') {
      pollingRef.current = window.setInterval(() => {
        const mod = moduleRef.current;
        if (!mod) return;
        const p = mod.ccall('get_progress', 'number', [], []);
        const playing = mod.ccall('is_playing', 'number', [], []);
        setProgress(p);
        if (!playing) {
          setState('paused');
          setProgress(mod.ccall('get_duration', 'number', [], []));
        }
      }, 100);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
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
    setErrorMsg('');
    setState('loading-cam');

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      const bufPtr = copyToWasm(mod, data);

      // Use dedicated TibiaRelic loader (bypasses TibiacamTV format detection)
      const dur = mod.ccall('load_recording_tibiarelic', 'number',
        ['number', 'number', 'number', 'number', 'number'],
        [bufPtr, data.length, 7, 72, 0]);

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
      setState('paused');
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
      mod.ccall('play', null, [], []);
      setState('playing');
    } else if (state === 'playing') {
      mod.ccall('pause_playback', null, [], []);
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
      mod.ccall('set_speed', null, ['number'], [newSpeed]);
    }
  };

  const handleSeek = (val: number[]) => {
    const ms = val[0];
    const mod = moduleRef.current;
    if (!mod) return;

    const wasPlaying = state === 'playing';
    if (wasPlaying) mod.ccall('pause_playback', null, [], []);

    mod.ccall('seek', null, ['number'], [ms]);
    setProgress(ms);

    if (wasPlaying) {
      mod.ccall('play', null, [], []);
    }
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

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Canvas / Upload Area */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[480/352] max-w-[960px] mx-auto bg-black rounded-sm overflow-hidden border-2 border-border/50"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          id="canvas"
          width={480}
          height={352}
          className="w-full h-full"
          style={{ imageRendering: 'auto' }}
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
              <p className="text-gold font-heading text-lg">
                {t('camPlayer.dropFile')}
              </p>
              <p className="text-muted-foreground text-sm">
                Formatos suportados: .cam (TibiaRelic)
              </p>
              {errorMsg && (
                <p className="text-destructive text-sm mt-2">{errorMsg}</p>
              )}
            </div>
            <Button
              variant="outline"
              className="mt-2 border-gold/50 text-gold hover:bg-gold/10"
              onClick={() => fileInputRef.current?.click()}
            >
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

      {/* Controls */}
      <div className="max-w-[960px] mx-auto w-full space-y-3">
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
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlayback}
              disabled={!hasRecording}
              className="border-border/50"
            >
              {state === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSeek([Math.max(0, progress - 10000)])}
              disabled={!hasRecording}
              className="border-border/50"
              title="-10s"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSeek([Math.min(duration, progress + 10000)])}
              disabled={!hasRecording}
              className="border-border/50"
              title="+10s"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cycleSpeed}
              disabled={!hasRecording}
              className="border-border/50 min-w-[60px]"
            >
              <FastForward className="w-3 h-3 mr-1" />
              {speed}x
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const next = !overlayEnabled;
                setOverlayEnabled(next);
                const mod = moduleRef.current;
                if (mod) {
                  mod.ccall('set_overlay', null, ['number'], [next ? 1 : 0]);
                }
              }}
              disabled={!hasRecording}
              className="border-border/50"
              title={overlayEnabled ? 'Esconder mensagens' : 'Mostrar mensagens'}
            >
              {overlayEnabled ? <MessageSquare className="w-4 h-4" /> : <MessageSquareOff className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {hasRecording && (
              <Button
                variant="outline"
                size="sm"
                className="border-border/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3 mr-1" />
                Outra .cam
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {state === 'idle' && !dataLoaded && 'Inicializando...'}
              {state === 'idle' && dataLoaded && t('camPlayer.noFileLoaded')}
              {isLoading && t('common.loading')}
              {state === 'playing' && t('camPlayer.playing')}
              {state === 'paused' && t('camPlayer.paused')}
              {state === 'error' && t('camPlayer.loadError')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TibiarcPlayer;
