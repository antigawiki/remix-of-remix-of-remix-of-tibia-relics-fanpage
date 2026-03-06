import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, Loader2, SkipBack, SkipForward, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { GameState } from '@/lib/tibiaRelic/gameState';
import { PacketParser } from '@/lib/tibiaRelic/packetParser';
import { Renderer } from '@/lib/tibiaRelic/renderer';
import { parseCamFile, type CamFrame } from '@/lib/tibiaRelic/camParser';

type PlayerState = 'idle' | 'loading-data' | 'ready' | 'loading-cam' | 'playing' | 'paused' | 'error';

interface JsCamPlayerProps {
  className?: string;
  onStateChange?: (info: { camBuffer: Uint8Array | null; progress: number; isPlaying: boolean }) => void;
  onFileNameChange?: (name: string) => void;
}

const JsCamPlayer = ({ className, onStateChange, onFileNameChange }: JsCamPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sprRef = useRef<SprLoader | null>(null);
  const datRef = useRef<DatLoader | null>(null);
  const framesRef = useRef<CamFrame[]>([]);
  const camBufferRef = useRef<Uint8Array | null>(null);
  const animRef = useRef<number | null>(null);
  const parserRef = useRef<PacketParser | null>(null);
  const frameIdxRef = useRef(0);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(1);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) { setControlsVisible(true); resetHideTimer(); }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (isFullscreen) resetHideTimer();
  }, [isFullscreen, resetHideTimer]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) container.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  // Load sprite + dat data files
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setState('loading-data');
      try {
        const [sprRes, datRes] = await Promise.all([
          fetch('/tibiarc/data/Tibia.spr'),
          fetch('/tibiarc/data/Tibia.dat'),
        ]);
        if (!sprRes.ok || !datRes.ok) throw new Error('Data files not found');
        const [sprBuf, datBuf] = await Promise.all([sprRes.arrayBuffer(), datRes.arrayBuffer()]);
        if (cancelled) return;

        const spr = new SprLoader();
        spr.load(sprBuf);
        sprRef.current = spr;

        const dat = new DatLoader();
        dat.load(datBuf);
        datRef.current = dat;

        setDataLoaded(true);
        setState('idle');
        console.log('[JsCamPlayer] Data files loaded');
      } catch (err) {
        if (cancelled) return;
        console.error('[JsCamPlayer] Init failed:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load data');
        setState('error');
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const processFramesUpTo = useCallback((targetMs: number) => {
    const dat = datRef.current;
    const renderer = rendererRef.current;
    if (!dat || !renderer) return;

    const frames = framesRef.current;
    // Reset game state and parser for seeking
    const gsNew = new GameState();
    renderer.gs = gsNew;
    const seekParser = new PacketParser(gsNew, dat, { looktypeU16: true, outfitWindowRangeU16: true });
    seekParser.seekMode = true;

    for (let i = 0; i < frames.length; i++) {
      if (frames[i].timestamp > targetMs) {
        frameIdxRef.current = i;
        break;
      }
      try {
        seekParser.process(frames[i].payload);
      } catch { /* skip broken frames */ }
      if (i === frames.length - 1) frameIdxRef.current = frames.length;
    }

    // Replace persistent parser with new one (seekMode off for live playback)
    const liveParser = new PacketParser(gsNew, dat, { looktypeU16: true, outfitWindowRangeU16: true });
    parserRef.current = liveParser;
  }, []);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    renderer.draw(canvas.width, canvas.height);
  }, []);

  const playbackLoop = useCallback(() => {
    const frames = framesRef.current;
    const renderer = rendererRef.current;
    if (!renderer || frames.length === 0) return;

    const elapsed = (performance.now() - startTimeRef.current) * speed + pauseOffsetRef.current;
    const parser = parserRef.current;
    if (!parser) return;

    // Process frames up to current elapsed time
    let idx = frameIdxRef.current;
    while (idx < frames.length && frames[idx].timestamp <= elapsed) {
      try {
        parser.process(frames[idx].payload);
      } catch { /* skip */ }
      idx++;
    }
    frameIdxRef.current = idx;

    renderFrame();
    setProgress(Math.min(elapsed, duration));
    onStateChange?.({ camBuffer: camBufferRef.current, progress: Math.min(elapsed, duration), isPlaying: true });

    if (elapsed >= duration) {
      setState('paused');
      setProgress(duration);
      onStateChange?.({ camBuffer: camBufferRef.current, progress: duration, isPlaying: false });
      return;
    }

    animRef.current = requestAnimationFrame(playbackLoop);
  }, [speed, duration, renderFrame, onStateChange]);

  const startPlayback = useCallback(() => {
    startTimeRef.current = performance.now();
    setState('playing');
    animRef.current = requestAnimationFrame(playbackLoop);
  }, [playbackLoop]);

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (ext !== '.cam') {
      setErrorMsg(t('camPlayer.invalidFormat'));
      setState('error');
      return;
    }

    setFileName(file.name);
    onFileNameChange?.(file.name);
    setErrorMsg('');
    setState('loading-cam');

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      camBufferRef.current = data;

      const camFile = parseCamFile(buffer);
      framesRef.current = camFile.frames;
      frameIdxRef.current = 0;
      pauseOffsetRef.current = 0;

      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not available');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get 2d context');

      const spr = sprRef.current!;
      const dat = datRef.current!;
      const gs = new GameState();
      const renderer = new Renderer(ctx, spr, dat, gs);
      rendererRef.current = renderer;

      setDuration(camFile.totalMs);
      setProgress(0);

      // Auto-play
      startTimeRef.current = performance.now();
      setState('playing');
      animRef.current = requestAnimationFrame(playbackLoop);

      console.log(`[JsCamPlayer] Loaded ${file.name}: ${(camFile.totalMs / 1000).toFixed(1)}s, ${camFile.frames.length} frames`);
    } catch (err) {
      console.error('[JsCamPlayer] Load failed:', err);
      setErrorMsg(err instanceof Error ? err.message : t('camPlayer.loadError'));
      setState('error');
    }
  }, [t, playbackLoop, onFileNameChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const togglePlayback = () => {
    if (state === 'paused') {
      pauseOffsetRef.current = progress;
      startTimeRef.current = performance.now();
      setState('playing');
      animRef.current = requestAnimationFrame(playbackLoop);
    } else if (state === 'playing') {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      pauseOffsetRef.current = progress;
      setState('paused');
      onStateChange?.({ camBuffer: camBufferRef.current, progress, isPlaying: false });
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 2, 4, 8];
    const idx = speeds.indexOf(speed);
    setSpeed(speeds[(idx + 1) % speeds.length]);
  };

  const handleSeek = (val: number[]) => {
    const ms = val[0];
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;

    processFramesUpTo(ms);
    renderFrame();
    setProgress(ms);
    pauseOffsetRef.current = ms;

    if (state === 'playing') {
      startTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(playbackLoop);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const isLoading = state === 'loading-data' || state === 'loading-cam';
  const hasRecording = state === 'playing' || state === 'paused';

  const renderControls = (overlay?: boolean) => (
    <div className={overlay
      ? `absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-4 py-3 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
      : 'space-y-3'
    }>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground min-w-[40px]">{formatTime(progress)}</span>
        <Slider value={[progress]} onValueChange={handleSeek} max={duration || 100} step={1000} className="flex-1" disabled={!hasRecording} />
        <span className="text-xs text-muted-foreground min-w-[40px] text-right">{formatTime(duration)}</span>
      </div>
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
            <FastForward className="w-3 h-3 mr-1" />{speed}x
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullscreen} disabled={!hasRecording} className="border-border/50">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {hasRecording && !overlay && (
            <Button variant="outline" size="sm" className="border-border/50" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1" />Outra .cam
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
      <div
        ref={containerRef}
        className={`relative ${isFullscreen ? 'bg-black flex items-center justify-center w-screen h-screen' : 'w-full max-w-[960px] mx-auto'}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onMouseMove={handleMouseMove}
      >
        <div className={`relative ${isFullscreen ? 'w-full h-full flex items-center justify-center' : 'aspect-[480/352] bg-black rounded-sm overflow-hidden border-2 border-border/50'}`}>
          <canvas
            ref={canvasRef}
            width={480}
            height={352}
            className={isFullscreen ? 'max-w-full max-h-full object-contain' : 'w-full h-full'}
            style={{ imageRendering: 'auto', ...(isFullscreen ? { aspectRatio: '480/352' } : {}) }}
          />

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

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <p className="text-gold text-sm">
                {state === 'loading-data' ? 'Carregando sprites...' : `Carregando ${fileName}...`}
              </p>
            </div>
          )}

          {hasRecording && (
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-gold/80">{fileName}</div>
          )}
        </div>

        {isFullscreen && hasRecording && renderControls(true)}
      </div>

      {!isFullscreen && (
        <div className="max-w-[960px] mx-auto w-full">{renderControls(false)}</div>
      )}
    </div>
  );
};

export default JsCamPlayer;
