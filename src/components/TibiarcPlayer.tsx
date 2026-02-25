import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n';

type PlayerState = 'idle' | 'loading-wasm' | 'ready' | 'loading-cam' | 'playing' | 'paused' | 'error' | 'need-version';

const TIBIA_VERSIONS = [
  { label: 'Auto-detect', value: '0.0.0' },
  { label: '7.1', value: '7.1.0' },
  { label: '7.2', value: '7.2.0' },
  { label: '7.3', value: '7.3.0' },
  { label: '7.4', value: '7.4.0' },
  { label: '7.5', value: '7.5.0' },
  { label: '7.6', value: '7.6.0' },
  { label: '7.7', value: '7.7.0' },
  { label: '7.72', value: '7.72.0' },
  { label: '7.8', value: '7.8.0' },
  { label: '7.9', value: '7.9.0' },
  { label: '7.92', value: '7.92.0' },
  { label: '8.0', value: '8.0.0' },
  { label: '8.1', value: '8.1.0' },
  { label: '8.2', value: '8.2.0' },
  { label: '8.4', value: '8.4.0' },
  { label: '8.5', value: '8.5.0' },
  { label: '8.6', value: '8.6.0' },
];

interface WasmModule {
  ccall: (name: string, returnType: string, argTypes: string[], args: unknown[]) => unknown;
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: unknown[]) => unknown;
  HEAPU8: Uint8Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
}

interface TibiarcPlayerProps {
  className?: string;
}

const TibiarcPlayer = ({ className }: TibiarcPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moduleRef = useRef<WasmModule | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const pendingFileRef = useRef<{ data: Uint8Array; name: string } | null>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(1);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wasmAvailable, setWasmAvailable] = useState<boolean | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('0.0.0');

  // Check WASM availability
  useEffect(() => {
    fetch('/tibiarc/tibiarc_player.js', { method: 'HEAD' })
      .then(res => setWasmAvailable(res.ok))
      .catch(() => setWasmAvailable(false));
  }, []);

  // Progress polling
  useEffect(() => {
    if (state === 'playing' && moduleRef.current) {
      progressIntervalRef.current = window.setInterval(() => {
        const mod = moduleRef.current;
        if (!mod) return;
        const p = mod.ccall('get_progress', 'number', [], []) as number;
        const isPlaying = mod.ccall('is_playing', 'number', [], []) as number;
        setProgress(p);
        if (!isPlaying) {
          setState('paused');
        }
      }, 100);
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [state]);

  const loadWasmModule = useCallback(async () => {
    if (moduleRef.current) return moduleRef.current;

    setState('loading-wasm');

    const script = document.createElement('script');
    script.src = '/tibiarc/tibiarc_player.js';

    return new Promise<WasmModule>((resolve, reject) => {
      script.onload = async () => {
        try {
          console.log('[TibiarcPlayer] Script loaded, checking window.TibiarcModule...');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const factory = (window as any).TibiarcModule;
          const canvas = canvasRef.current;
          console.log('[TibiarcPlayer] factory:', typeof factory, 'canvas:', !!canvas);
          if (!factory || !canvas) throw new Error('Module not found - factory: ' + typeof factory + ', canvas: ' + !!canvas);

          console.log('[TibiarcPlayer] Calling factory with canvas...');
          const mod = await factory({ canvas }) as WasmModule;
          console.log('[TibiarcPlayer] Module instantiated, loading data files...');
          moduleRef.current = mod;

          // Load Tibia data files
          const [picRes, sprRes, datRes] = await Promise.all([
            fetch('/tibiarc/data/Tibia.pic'),
            fetch('/tibiarc/data/Tibia.spr'),
            fetch('/tibiarc/data/Tibia.dat'),
          ]);

          if (!picRes.ok || !sprRes.ok || !datRes.ok) {
            throw new Error('Tibia data files not found');
          }

          const [pic, spr, dat] = await Promise.all([
            picRes.arrayBuffer(),
            sprRes.arrayBuffer(),
            datRes.arrayBuffer(),
          ]);

          const picArr = new Uint8Array(pic);
          const sprArr = new Uint8Array(spr);
          const datArr = new Uint8Array(dat);

          const picPtr = mod._malloc(picArr.length);
          const sprPtr = mod._malloc(sprArr.length);
          const datPtr = mod._malloc(datArr.length);

          mod.HEAPU8.set(picArr, picPtr);
          mod.HEAPU8.set(sprArr, sprPtr);
          mod.HEAPU8.set(datArr, datPtr);

          const result = mod.ccall('load_data_files', 'number',
            ['number', 'number', 'number', 'number', 'number', 'number'],
            [picPtr, picArr.length, sprPtr, sprArr.length, datPtr, datArr.length]
          );

          mod._free(picPtr);
          mod._free(sprPtr);
          mod._free(datPtr);

          if (!result) throw new Error('Failed to load data files');

          resolve(mod);
        } catch (err) {
          console.error('[TibiarcPlayer] Error during WASM init:', err);
          reject(err);
        }
      };
      script.onerror = (e) => {
        console.error('[TibiarcPlayer] Script load error:', e);
        reject(new Error('Failed to load WASM script'));
      };
      document.head.appendChild(script);
    });
  }, []);

  const loadRecordingWithVersion = useCallback(async (data: Uint8Array, name: string, version: string) => {
    const mod = moduleRef.current;
    if (!mod) return;

    setState('loading-cam');

    const ptr = mod._malloc(data.length);
    mod.HEAPU8.set(data, ptr);

    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(name + '\0');
    const namePtr = mod._malloc(nameBytes.length);
    mod.HEAPU8.set(nameBytes, namePtr);

    const [major, minor, patch] = version.split('.').map(Number);

    // Try load_recording_with_version first, fallback to load_recording
    let durationMs: number;
    try {
      durationMs = mod.ccall('load_recording_with_version', 'number',
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [ptr, data.length, namePtr, major, minor, patch]
      ) as number;
    } catch {
      // Fallback: old WASM without load_recording_with_version
      console.log('[TibiarcPlayer] load_recording_with_version not available, using load_recording');
      durationMs = mod.ccall('load_recording', 'number',
        ['number', 'number', 'number'],
        [ptr, data.length, namePtr]
      ) as number;
    }

    mod._free(ptr);
    mod._free(namePtr);

    if (durationMs === -1) {
      // Version detection failed, ask user
      pendingFileRef.current = { data, name };
      setState('need-version');
      return;
    }

    if (!durationMs) {
      setErrorMsg(t('camPlayer.loadError'));
      setState('error');
      return;
    }

    setDuration(durationMs);
    setProgress(0);
    setState('paused');
  }, [t]);

  const handleFileSelect = useCallback(async (file: File) => {
    const validExtensions = ['.cam', '.rec', '.tmv2', '.trp', '.ttm', '.yatc', '.recording'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(ext)) {
      setErrorMsg(t('camPlayer.invalidFormat'));
      setState('error');
      return;
    }

    setFileName(file.name);
    setErrorMsg('');

    try {
      await loadWasmModule();
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      await loadRecordingWithVersion(data, file.name, selectedVersion);
    } catch (err) {
      console.error('Failed to load recording:', err);
      setErrorMsg(err instanceof Error ? err.message : t('camPlayer.loadError'));
      setState('error');
    }
  }, [loadWasmModule, loadRecordingWithVersion, selectedVersion, t]);

  const handleRetryWithVersion = useCallback(async () => {
    const pending = pendingFileRef.current;
    if (!pending || selectedVersion === '0.0.0') return;

    try {
      await loadRecordingWithVersion(pending.data, pending.name, selectedVersion);
    } catch (err) {
      console.error('Failed to load recording:', err);
      setErrorMsg(err instanceof Error ? err.message : t('camPlayer.loadError'));
      setState('error');
    }
  }, [selectedVersion, loadRecordingWithVersion, t]);

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
      mod.ccall('set_speed', null, ['number'], [speed]);
      setState('playing');
    } else if (state === 'playing') {
      mod.ccall('pause_playback', null, [], []);
      setState('paused');
    }
  };

  const resetPlayback = () => {
    const mod = moduleRef.current;
    if (mod) {
      mod.ccall('pause_playback', null, [], []);
      mod.ccall('seek', null, ['number'], [0]);
    }
    setProgress(0);
    setState('paused');
  };

  const cycleSpeed = () => {
    const speeds = [1, 2, 4, 8];
    const currentIndex = speeds.indexOf(speed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(newSpeed);
    if (moduleRef.current) {
      moduleRef.current.ccall('set_speed', null, ['number'], [newSpeed]);
    }
  };

  const handleSeek = (val: number[]) => {
    const ms = val[0];
    setProgress(ms);
    if (moduleRef.current) {
      moduleRef.current.ccall('seek', null, ['number'], [ms]);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const isLoading = state === 'loading-wasm' || state === 'loading-cam';
  const hasRecording = state === 'playing' || state === 'paused';

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Version selector */}
      <div className="max-w-[800px] mx-auto w-full flex items-center gap-3">
        <label className="text-sm text-muted-foreground whitespace-nowrap">Tibia Version:</label>
        <Select value={selectedVersion} onValueChange={setSelectedVersion}>
          <SelectTrigger className="w-[160px] border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIBIA_VERSIONS.map(v => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Canvas / Upload Area */}
      <div
        className="relative w-full aspect-[4/3] max-w-[800px] mx-auto bg-black rounded-sm overflow-hidden border-2 border-border/50"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Idle overlay */}
        {(state === 'idle' || state === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
            <Upload className="w-12 h-12 text-gold/60" />
            <div className="text-center space-y-2">
              <p className="text-gold font-heading text-lg">
                {t('camPlayer.dropFile')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('camPlayer.supportedFormats')}
              </p>
              {wasmAvailable === false && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm max-w-md">
                  <p className="text-destructive text-sm">{t('camPlayer.wasmNotFound')}</p>
                  <p className="text-muted-foreground text-xs mt-1">{t('camPlayer.wasmInstructions')}</p>
                </div>
              )}
              {errorMsg && (
                <p className="text-destructive text-sm mt-2">{errorMsg}</p>
              )}
            </div>
            <Button
              variant="outline"
              className="mt-2 border-gold/50 text-gold hover:bg-gold/10"
              onClick={() => fileInputRef.current?.click()}
              disabled={wasmAvailable === false}
            >
              {t('camPlayer.selectFile')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".cam,.rec,.tmv2,.trp,.ttm,.yatc,.recording"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        )}

        {/* Need version overlay */}
        {state === 'need-version' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
            <div className="text-center space-y-3 max-w-md">
              <p className="text-gold font-heading text-lg">
                Versão não detectada
              </p>
              <p className="text-muted-foreground text-sm">
                Não foi possível detectar a versão do Tibia automaticamente. Selecione a versão acima e clique em "Carregar".
              </p>
              <Button
                variant="outline"
                className="mt-2 border-gold/50 text-gold hover:bg-gold/10"
                onClick={handleRetryWithVersion}
                disabled={selectedVersion === '0.0.0'}
              >
                Carregar com versão {selectedVersion !== '0.0.0' ? TIBIA_VERSIONS.find(v => v.value === selectedVersion)?.label : '...'}
              </Button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <p className="text-gold text-sm">
              {state === 'loading-wasm' ? t('camPlayer.loadingWasm') : `${t('camPlayer.loadingFile')} ${fileName}`}
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
      <div className="max-w-[800px] mx-auto w-full space-y-3">
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
              onClick={resetPlayback}
              disabled={!hasRecording}
              className="border-border/50"
            >
              <RotateCcw className="w-4 h-4" />
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
          </div>

          <div className="text-sm text-muted-foreground">
            {state === 'idle' && t('camPlayer.noFileLoaded')}
            {isLoading && t('common.loading')}
            {state === 'playing' && t('camPlayer.playing')}
            {state === 'paused' && t('camPlayer.paused')}
            {state === 'error' && t('camPlayer.loadError')}
            {state === 'need-version' && 'Selecione a versão'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TibiarcPlayer;
