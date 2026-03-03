import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, Loader2, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';
import { parseCamFile, type CamFile } from '@/lib/tibiaRelic/camParser';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { GameState, type GameStateSnapshot } from '@/lib/tibiaRelic/gameState';
import { PacketParser } from '@/lib/tibiaRelic/packetParser';
import { Renderer } from '@/lib/tibiaRelic/renderer';

type PlayerState = 'idle' | 'loading-data' | 'ready' | 'loading-cam' | 'playing' | 'paused' | 'error';

interface JsCamPlayerProps {
  className?: string;
}

const SNAPSHOT_INTERVAL_MS = 30_000; // snapshot every 30s

const JsCamPlayer = ({ className }: JsCamPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core engine refs (not state — these are mutable and don't trigger renders)
  const sprRef = useRef<SprLoader | null>(null);
  const datRef = useRef<DatLoader | null>(null);
  const gsRef = useRef<GameState | null>(null);
  const parserRef = useRef<PacketParser | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const camRef = useRef<CamFile | null>(null);

  // Playback state refs
  const frameIndexRef = useRef(0);
  const currentMsRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);
  const speedRef = useRef(1);
  const stateRef = useRef<PlayerState>('idle');
  const snapshotsRef = useRef<Array<{ ms: number; frameIndex: number; snap: GameStateSnapshot }>>([]);

  // Fullscreen
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

  const setPlayerState = useCallback((s: PlayerState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  // Fullscreen handling
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

  // Load data files on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setPlayerState('loading-data');
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
        const dat = new DatLoader();
        dat.load(datBuf);

        sprRef.current = spr;
        datRef.current = dat;
        setDataLoaded(true);
        setPlayerState('idle');
        console.log(`[JsCamPlayer] Data loaded: ${spr.count} sprites, ${dat.items.size} items, ${dat.outfits.size} outfits`);
      } catch (err) {
        if (cancelled) return;
        console.error('[JsCamPlayer] Init failed:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load data');
        setPlayerState('error');
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Build snapshots for seek optimization
  const buildSnapshots = useCallback((cam: CamFile, gs: GameState, parser: PacketParser) => {
    const snapshots: Array<{ ms: number; frameIndex: number; snap: GameStateSnapshot }> = [];
    gs.reset();
    parser.seekMode = true;
    let nextSnapshotMs = SNAPSHOT_INTERVAL_MS;

    for (let i = 0; i < cam.frames.length; i++) {
      const frame = cam.frames[i];
      try { parser.process(frame.payload); } catch { /* skip bad frame */ }
      if (frame.timestamp >= nextSnapshotMs) {
        snapshots.push({ ms: frame.timestamp, frameIndex: i + 1, snap: gs.snapshot() });
        nextSnapshotMs = frame.timestamp + SNAPSHOT_INTERVAL_MS;
      }
    }

    parser.seekMode = false;
    gs.reset();
    return snapshots;
  }, []);

  // Seek to a specific ms position
  const seekToMs = useCallback((targetMs: number) => {
    const cam = camRef.current;
    const gs = gsRef.current;
    const parser = parserRef.current;
    const renderer = rendererRef.current;
    if (!cam || !gs || !parser || !renderer) return;

    // Find best snapshot
    const snapshots = snapshotsRef.current;
    let bestSnap: typeof snapshots[0] | null = null;
    for (const s of snapshots) {
      if (s.ms <= targetMs) bestSnap = s;
      else break;
    }

    parser.seekMode = true;

    if (bestSnap) {
      gs.restore(bestSnap.snap);
      frameIndexRef.current = bestSnap.frameIndex;
    } else {
      gs.reset();
      frameIndexRef.current = 0;
    }

    // Process remaining frames up to target
    while (frameIndexRef.current < cam.frames.length) {
      const frame = cam.frames[frameIndexRef.current];
      if (frame.timestamp > targetMs) break;
      try { parser.process(frame.payload); } catch { /* skip */ }
      frameIndexRef.current++;
    }

    parser.seekMode = false;
    currentMsRef.current = targetMs;

    // Render current frame
    const canvas = canvasRef.current;
    if (canvas) {
      renderer.incTick();
      renderer.draw(canvas.width, canvas.height);
    }
  }, []);

  // Animation loop
  const startLoop = useCallback(() => {
    lastTimeRef.current = performance.now();
    const loop = (now: number) => {
      if (stateRef.current !== 'playing') return;

      const cam = camRef.current;
      const gs = gsRef.current;
      const parser = parserRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!cam || !gs || !parser || !renderer || !canvas) return;

      const elapsed = (now - lastTimeRef.current) * speedRef.current;
      lastTimeRef.current = now;
      currentMsRef.current += elapsed;

      // Process frames up to current time
      while (frameIndexRef.current < cam.frames.length) {
        const frame = cam.frames[frameIndexRef.current];
        if (frame.timestamp > currentMsRef.current) break;
        try { parser.process(frame.payload); } catch { /* skip bad frame */ }
        frameIndexRef.current++;
      }

      renderer.incTick();
      renderer.draw(canvas.width, canvas.height);

      // Update progress (throttled to avoid too many state updates)
      setProgress(Math.floor(currentMsRef.current));

      // Check if playback ended
      if (frameIndexRef.current >= cam.frames.length && currentMsRef.current >= cam.totalMs) {
        setPlayerState('paused');
        setProgress(cam.totalMs);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [setPlayerState]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopLoop(); };
  }, [stopLoop]);

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'cam') {
      setErrorMsg(t('camPlayer.invalidFormat'));
      setPlayerState('error');
      return;
    }

    const spr = sprRef.current;
    const dat = datRef.current;
    const canvas = canvasRef.current;
    if (!spr || !dat || !canvas) return;

    setFileName(file.name);
    setErrorMsg('');
    setPlayerState('loading-cam');

    try {
      const buffer = await file.arrayBuffer();
      const cam = parseCamFile(buffer);
      if (cam.frames.length === 0) {
        setErrorMsg(t('camPlayer.loadError'));
        setPlayerState('error');
        return;
      }

      camRef.current = cam;

      // Initialize engine
      const gs = new GameState();
      const parser = new PacketParser(gs, dat, { looktypeU16: true });
      const ctx = canvas.getContext('2d')!;
      const renderer = new Renderer(ctx, spr, dat, gs);

      gsRef.current = gs;
      parserRef.current = parser;
      rendererRef.current = renderer;

      // Build snapshots (fast — ~200ms for 26k frames)
      console.time('[JsCamPlayer] Building snapshots');
      const snapshots = buildSnapshots(cam, gs, parser);
      snapshotsRef.current = snapshots;
      console.timeEnd('[JsCamPlayer] Building snapshots');
      console.log(`[JsCamPlayer] ${snapshots.length} snapshots built for ${cam.frames.length} frames`);

      // Reset state for playback
      gs.reset();
      frameIndexRef.current = 0;
      currentMsRef.current = 0;

      setDuration(cam.totalMs);
      setProgress(0);

      // Auto-play
      setPlayerState('playing');
      startLoop();

      console.log(`[JsCamPlayer] Loaded ${file.name}: ${(cam.totalMs / 1000).toFixed(1)}s, ${cam.frames.length} frames`);
    } catch (err) {
      console.error('Failed to load .cam:', err);
      setErrorMsg(err instanceof Error ? err.message : t('camPlayer.loadError'));
      setPlayerState('error');
    }
  }, [t, buildSnapshots, startLoop, setPlayerState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const togglePlayback = useCallback(() => {
    if (state === 'paused') {
      setPlayerState('playing');
      startLoop();
    } else if (state === 'playing') {
      stopLoop();
      setPlayerState('paused');
    }
  }, [state, startLoop, stopLoop, setPlayerState]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 2, 4, 8];
    const currentIndex = speeds.indexOf(speed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(newSpeed);
    speedRef.current = newSpeed;
  }, [speed]);

  const handleSeek = useCallback((val: number[]) => {
    const ms = val[0];
    const wasPlaying = stateRef.current === 'playing';
    if (wasPlaying) stopLoop();

    seekToMs(ms);
    setProgress(ms);

    if (wasPlaying) {
      setPlayerState('playing');
      startLoop();
    }
  }, [seekToMs, stopLoop, startLoop, setPlayerState]);

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
        <Slider
          value={[progress]}
          max={duration}
          step={1000}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground min-w-[40px]">{formatTime(duration)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={togglePlayback} className="text-gold hover:text-gold/80">
            {state === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={cycleSpeed} className="text-xs font-mono text-muted-foreground hover:text-foreground">
            <FastForward className="w-3 h-3 mr-1" /> {speed}x
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-muted-foreground hover:text-foreground">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`} onMouseMove={handleMouseMove}>
      <div className="bg-card border border-border/50 rounded-sm overflow-hidden">
        <div className="relative aspect-[480/352] bg-[#1a2420]">
          <canvas
            ref={canvasRef}
            width={480}
            height={352}
            className="w-full h-full"
            style={{ imageRendering: 'auto' }}
          />

          {/* Drop zone overlay */}
          {(state === 'idle' || state === 'error') && dataLoaded && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-[#1a2420]/90"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <Upload className="w-10 h-10 text-gold/60 mb-3" />
              <p className="text-sm text-gold/80 font-heading">{t('camPlayer.dropFile')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('camPlayer.supportedFormats')}</p>
              {state === 'error' && errorMsg && (
                <p className="text-xs text-destructive mt-2 max-w-[300px] text-center">{errorMsg}</p>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a2420]/80">
              <Loader2 className="w-8 h-8 text-gold animate-spin mb-2" />
              <p className="text-xs text-muted-foreground">
                {state === 'loading-data' ? t('camPlayer.loadingData') : t('camPlayer.loadingCam')}
              </p>
              {fileName && <p className="text-xs text-gold/60 mt-1">{fileName}</p>}
            </div>
          )}

          {/* Fullscreen controls overlay */}
          {hasRecording && isFullscreen && renderControls(true)}
        </div>

        {/* Normal controls */}
        {hasRecording && !isFullscreen && (
          <div className="px-4 py-3 border-t border-border/30 bg-card">
            {renderControls()}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".cam"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
      />
    </div>
  );
};

export default JsCamPlayer;
