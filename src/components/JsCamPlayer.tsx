import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, Loader2, SkipBack, SkipForward, MessageSquare, MessageSquareOff, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { GameState, type GameStateSnapshot } from '@/lib/tibiaRelic/gameState';
import { PacketParser } from '@/lib/tibiaRelic/packetParser';
import { Renderer } from '@/lib/tibiaRelic/renderer';
import { parseCamFile, type CamFile } from '@/lib/tibiaRelic/camParser';

type PlayerState = 'idle' | 'loading-data' | 'ready' | 'loading-cam' | 'playing' | 'paused' | 'error';

interface JsCamPlayerProps {
  className?: string;
}

const SNAPSHOT_INTERVAL = 500; // frames between snapshots

const JsCamPlayer = ({ className }: JsCamPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  // Engine refs (not state — used in rAF loop)
  const sprRef = useRef<SprLoader | null>(null);
  const datRef = useRef<DatLoader | null>(null);
  const gsRef = useRef<GameState | null>(null);
  const parserRef = useRef<PacketParser | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const camRef = useRef<CamFile | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameIdxRef = useRef(0);
  const playStartRef = useRef(0); // performance.now() when play started
  const playOffsetRef = useRef(0); // cam-time offset when play started
  const speedRef = useRef(1);
  const snapshotsRef = useRef<{ frameIdx: number; timestamp: number; snap: GameStateSnapshot }[]>([]);

  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(1);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Fullscreen sync
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

  // Load DAT + SPR on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setState('loading-data');
      try {
        const [sprRes, datRes] = await Promise.all([
          fetch('/tibiarc/data/Tibia.spr'),
          fetch('/tibiarc/data/Tibia.dat'),
        ]);
        if (!sprRes.ok || !datRes.ok) throw new Error('Tibia data files not found');
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
        console.log(`[JsCamPlayer] Data loaded: ${spr.count} sprites, ${dat.items.size} items, ${dat.outfits.size} outfits`);
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

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  /** Initialize game engine for a new cam file */
  const initEngine = useCallback(() => {
    const spr = sprRef.current;
    const dat = datRef.current;
    const canvas = canvasRef.current;
    if (!spr || !dat || !canvas) return false;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return false;

    const gs = new GameState();
    const parser = new PacketParser(gs, dat, { looktypeU16: true, outfitWindowRangeU16: true });
    const renderer = new Renderer(ctx, spr, dat, gs);

    gsRef.current = gs;
    parserRef.current = parser;
    rendererRef.current = renderer;
    frameIdxRef.current = 0;
    snapshotsRef.current = [];
    return true;
  }, []);

  /** Process frames from startIdx up to targetMs, building snapshots */
  const replayTo = useCallback((cam: CamFile, targetMs: number, fromIdx: number) => {
    const parser = parserRef.current!;
    const gs = gsRef.current!;
    const frames = cam.frames;
    let idx = fromIdx;

    // Seek mode: suppress walk animations
    parser.seekMode = true;
    while (idx < frames.length && frames[idx].timestamp <= targetMs) {
      try {
        parser.process(frames[idx].payload);
      } catch (e) {
        // Skip corrupted frame
      }
      idx++;

      // Build snapshots during replay
      if (idx % SNAPSHOT_INTERVAL === 0) {
        const existing = snapshotsRef.current;
        const lastSnap = existing.length > 0 ? existing[existing.length - 1] : null;
        if (!lastSnap || lastSnap.frameIdx < idx) {
          existing.push({ frameIdx: idx, timestamp: frames[idx - 1].timestamp, snap: gs.snapshot() });
        }
      }
    }
    parser.seekMode = false;
    frameIdxRef.current = idx;
  }, []);

  /** Start the rAF playback loop */
  const startLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const loop = () => {
      const cam = camRef.current;
      const parser = parserRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!cam || !parser || !renderer || !canvas) return;

      const now = performance.now();
      const elapsed = (now - playStartRef.current) * speedRef.current;
      const targetMs = playOffsetRef.current + elapsed;

      // Process pending frames
      const frames = cam.frames;
      let idx = frameIdxRef.current;
      while (idx < frames.length && frames[idx].timestamp <= targetMs) {
        try {
          parser.process(frames[idx].payload);
        } catch {
          // skip corrupted frame
        }
        idx++;

        // Build snapshots during normal playback too
        if (idx % SNAPSHOT_INTERVAL === 0) {
          const existing = snapshotsRef.current;
          const lastSnap = existing.length > 0 ? existing[existing.length - 1] : null;
          if (!lastSnap || lastSnap.frameIdx < idx) {
            existing.push({ frameIdx: idx, timestamp: frames[idx - 1].timestamp, snap: gsRef.current!.snapshot() });
          }
        }
      }
      frameIdxRef.current = idx;

      // Render
      renderer.incTick();
      renderer.draw(canvas.width, canvas.height);

      // Update progress (throttled)
      const currentMs = Math.min(targetMs, cam.totalMs);
      setProgress(currentMs);

      // Check if ended
      if (idx >= frames.length) {
        setState('paused');
        setProgress(cam.totalMs);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (ext !== '.cam') {
      setErrorMsg(t('camPlayer.invalidFormat'));
      setState('error');
      return;
    }

    setFileName(file.name);
    setErrorMsg('');
    setState('loading-cam');

    try {
      const buffer = await file.arrayBuffer();
      const cam = parseCamFile(buffer);
      if (cam.frames.length === 0) {
        setErrorMsg(t('camPlayer.loadError'));
        setState('error');
        return;
      }

      camRef.current = cam;
      setDuration(cam.totalMs);
      setProgress(0);

      if (!initEngine()) {
        setErrorMsg('Failed to initialize renderer');
        setState('error');
        return;
      }

      // Start playback
      playOffsetRef.current = 0;
      playStartRef.current = performance.now();
      speedRef.current = speed;
      setState('playing');
      startLoop();

      console.log(`[JsCamPlayer] Loaded ${file.name}: ${cam.frames.length} frames, ${(cam.totalMs / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error('Failed to load .cam:', err);
      setErrorMsg(err instanceof Error ? err.message : t('camPlayer.loadError'));
      setState('error');
    }
  }, [t, initEngine, startLoop, speed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const togglePlayback = useCallback(() => {
    if (state === 'playing') {
      // Pause
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // Save current position
      const now = performance.now();
      const elapsed = (now - playStartRef.current) * speedRef.current;
      playOffsetRef.current = playOffsetRef.current + elapsed;
      setState('paused');
    } else if (state === 'paused') {
      // Resume
      playStartRef.current = performance.now();
      speedRef.current = speed;
      setState('playing');
      startLoop();
    }
  }, [state, speed, startLoop]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 2, 4, 8];
    const currentIndex = speeds.indexOf(speed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(newSpeed);
    speedRef.current = newSpeed;

    // If playing, recalculate offset so position doesn't jump
    if (state === 'playing') {
      const now = performance.now();
      const elapsed = (now - playStartRef.current) * speedRef.current;
      playOffsetRef.current = playOffsetRef.current + elapsed;
      playStartRef.current = now;
      speedRef.current = newSpeed;
    }
  }, [speed, state]);

  const handleSeek = useCallback((val: number[]) => {
    const targetMs = val[0];
    setProgress(targetMs);

    const cam = camRef.current;
    if (!cam) return;

    // Stop current playback
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    // Find best snapshot before target
    const snapshots = snapshotsRef.current;
    let bestSnap: typeof snapshots[0] | null = null;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].timestamp <= targetMs) {
        bestSnap = snapshots[i];
        break;
      }
    }

    const gs = gsRef.current!;
    const parser = parserRef.current!;

    if (bestSnap) {
      // Restore snapshot
      gs.restore(bestSnap.snap);
      frameIdxRef.current = bestSnap.frameIdx;
    } else {
      // Replay from beginning
      gs.reset();
      frameIdxRef.current = 0;
    }

    // Replay remaining frames to target
    replayTo(cam, targetMs, frameIdxRef.current);

    // Render current state
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (renderer && canvas) {
      renderer.incTick();
      renderer.draw(canvas.width, canvas.height);
    }

    // Update offsets
    playOffsetRef.current = targetMs;
    playStartRef.current = performance.now();

    // Resume if was playing
    if (state === 'playing') {
      startLoop();
    }
  }, [state, replayTo, startLoop]);

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
          <Button variant="outline" size="icon" onClick={toggleFullscreen} disabled={!hasRecording} className="border-border/50" title={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen'}>
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
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); if (e.target) e.target.value = ''; }}
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
                {state === 'loading-data' ? 'Carregando sprites e dados...' : `Carregando ${fileName}...`}
              </p>
            </div>
          )}
          {hasRecording && (
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-gold/80">
              {fileName} <span className="text-muted-foreground ml-1">(JS Player)</span>
            </div>
          )}
        </div>
        {isFullscreen && hasRecording && renderControls(true)}
      </div>
      {!isFullscreen && (
        <div className="max-w-[960px] mx-auto w-full">
          {renderControls(false)}
        </div>
      )}
    </div>
  );
};

export default JsCamPlayer;
