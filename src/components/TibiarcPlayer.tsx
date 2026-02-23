import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';

type PlayerState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

interface TibiarcPlayerProps {
  className?: string;
}

const TibiarcPlayer = ({ className }: TibiarcPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(1);
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [wasmLoaded, setWasmLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  // Check if WASM files exist
  useEffect(() => {
    fetch('/tibiarc/gui.js', { method: 'HEAD' })
      .then(res => {
        setWasmLoaded(res.ok);
        if (!res.ok) {
          setErrorMsg(t('camPlayer.wasmNotFound'));
        }
      })
      .catch(() => {
        setWasmLoaded(false);
        setErrorMsg(t('camPlayer.wasmNotFound'));
      });
  }, [t]);

  const handleFileSelect = useCallback((file: File) => {
    const validExtensions = ['.cam', '.rec', '.tmv2', '.trp', '.ttm', '.yatc', '.recording'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setErrorMsg(t('camPlayer.invalidFormat'));
      return;
    }

    setFileName(file.name);
    setState('loading');
    setErrorMsg('');
    setProgress(0);

    if (!wasmLoaded) {
      setErrorMsg(t('camPlayer.wasmNotFound'));
      setState('error');
      return;
    }

    // When WASM is available, this will:
    // 1. Read the file as ArrayBuffer
    // 2. Write it to Emscripten's MEMFS
    // 3. Call the tibiarc player function
    // For now, show a placeholder state
    const reader = new FileReader();
    reader.onload = () => {
      // TODO: Integration with actual WASM module
      // const data = new Uint8Array(reader.result as ArrayBuffer);
      // Module.FS.writeFile('/recording' + ext, data);
      // Module._start_playback('/recording' + ext);
      setState('ready');
    };
    reader.onerror = () => {
      setErrorMsg(t('camPlayer.loadError'));
      setState('error');
    };
    reader.readAsArrayBuffer(file);
  }, [wasmLoaded, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const togglePlayback = () => {
    if (state === 'ready' || state === 'paused') {
      setState('playing');
    } else if (state === 'playing') {
      setState('paused');
    }
  };

  const resetPlayback = () => {
    setState('idle');
    setFileName('');
    setProgress(0);
    setSpeed(1);
    setErrorMsg('');
  };

  const cycleSpeed = () => {
    const speeds = [1, 2, 4, 8];
    const currentIndex = speeds.indexOf(speed);
    setSpeed(speeds[(currentIndex + 1) % speeds.length]);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Canvas / Upload Area */}
      <div
        className="relative w-full aspect-[4/3] max-w-[800px] mx-auto bg-black rounded-sm overflow-hidden border-2 border-border/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Overlay for idle/loading states */}
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
              {!wasmLoaded && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm max-w-md">
                  <p className="text-destructive text-sm">
                    {t('camPlayer.wasmNotFound')}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t('camPlayer.wasmInstructions')}
                  </p>
                </div>
              )}
              {errorMsg && state === 'error' && (
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

        {/* Loading overlay */}
        {state === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-gold text-sm">{t('camPlayer.loadingFile')} {fileName}</p>
          </div>
        )}

        {/* Ready overlay (WASM not yet integrated) */}
        {state === 'ready' && !wasmLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
            <Play className="w-12 h-12 text-gold/60" />
            <p className="text-gold text-sm font-heading">{fileName}</p>
            <p className="text-muted-foreground text-xs">{t('camPlayer.wasmNotFound')}</p>
          </div>
        )}

        {/* File name indicator when playing */}
        {(state === 'playing' || state === 'paused') && (
          <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-gold/80">
            {fileName}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="max-w-[800px] mx-auto w-full space-y-3">
        {/* Progress bar */}
        <Slider
          value={[progress]}
          onValueChange={([val]) => setProgress(val)}
          max={100}
          step={0.1}
          className="w-full"
          disabled={state === 'idle' || state === 'loading'}
        />

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlayback}
              disabled={state === 'idle' || state === 'loading' || !wasmLoaded}
              className="border-border/50"
            >
              {state === 'playing' ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetPlayback}
              disabled={state === 'idle'}
              className="border-border/50"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cycleSpeed}
              disabled={state === 'idle' || state === 'loading'}
              className="border-border/50 min-w-[60px]"
            >
              <FastForward className="w-3 h-3 mr-1" />
              {speed}x
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {state === 'idle' && t('camPlayer.noFileLoaded')}
            {state === 'loading' && t('common.loading')}
            {state === 'ready' && t('camPlayer.ready')}
            {state === 'playing' && t('camPlayer.playing')}
            {state === 'paused' && t('camPlayer.paused')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TibiarcPlayer;
