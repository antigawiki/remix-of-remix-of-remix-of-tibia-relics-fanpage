import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, Loader2, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';
import { parseCamFile, type CamFile } from '@/lib/tibiaRelic/camParser';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { PacketParser } from '@/lib/tibiaRelic/packetParser';
import { GameState, type GameStateSnapshot } from '@/lib/tibiaRelic/gameState';
import { Renderer } from '@/lib/tibiaRelic/renderer';
import { DebugLogger } from '@/lib/tibiaRelic/debugLogger';


type PlayerState = 'idle' | 'loading-data' | 'ready' | 'loading-cam' | 'playing' | 'paused' | 'error';

interface TibiarcPlayerProps {
  className?: string;
}

/** TibiaRelic 7.72 always uses u16 looktypes — no heuristic detection */
const createPacketParser = (gs: GameState, dat: DatLoader) =>
  new PacketParser(gs, dat, {
    looktypeU16: true,
    outfitWindowRangeU16: true,
  });

const TibiarcPlayer = ({ className }: TibiarcPlayerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const engineRef = useRef<{
    spr: SprLoader;
    dat: DatLoader;
    gs: GameState;
    parser: PacketParser;
    renderer: Renderer;
    cam: CamFile | null;
    curFrame: number;
    curMs: number;
    wallT0: number;
    camT0Ms: number;
    speed: number;
    playing: boolean;
    rafId: number | null;
    _lastProgressUpdate: number;
    keyframes: { ms: number; frameIdx: number; snap: GameStateSnapshot }[];
    lastKeyframeMs: number;
  } | null>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(1);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debugLoggerRef = useRef<DebugLogger>(new DebugLogger());

  // Dynamic canvas sizing via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(width * dpr);
        const h = Math.round(height * dpr);
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
          canvas.width = w;
          canvas.height = h;
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Load Tibia data files on mount
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
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
        const dat = new DatLoader();
        dat.load(datBuf);
        const gs = new GameState();
        const parser = createPacketParser(gs, dat);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderer = new Renderer(ctx, spr, dat, gs);
        parser.debugLogger = debugLoggerRef.current;
        renderer.debugLogger = debugLoggerRef.current;

        engineRef.current = {
          spr, dat, gs, parser, renderer,
          cam: null, curFrame: 0, curMs: 0,
          wallT0: 0, camT0Ms: 0, speed: 1,
          playing: false, rafId: null, _lastProgressUpdate: 0,
          keyframes: [], lastKeyframeMs: -Infinity,
        };

        setDataLoaded(true);
        setState('idle');
        console.log(`[TibiarcPlayer] Loaded: ${spr.count} sprites, ${dat.items.size} items, ${dat.outfits.size} outfits`);
      } catch (err) {
        if (cancelled) return;
        console.error('[TibiarcPlayer] Failed to load data:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load data');
        setState('error');
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Animation loop
  useEffect(() => {
    let rafId: number;

    const loop = (_time: number) => {
      rafId = requestAnimationFrame(loop);

      const engine = engineRef.current;
      if (!engine) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      if (engine.playing && engine.cam) {
        const now = performance.now();
        const elapsed = (now - engine.wallT0) / 1000;
        const target = Math.floor(engine.camT0Ms + elapsed * 1000 * engine.speed);

        if (target >= engine.cam.totalMs) {
          applyTo(engine, engine.cam.totalMs);
          engine.playing = false;
          setState('paused');
          setProgress(engine.curMs);
        } else {
          applyTo(engine, target);
          if (!engine._lastProgressUpdate || now - engine._lastProgressUpdate > 100) {
            engine._lastProgressUpdate = now;
            setProgress(engine.curMs);
          }
        }
      }

      // Always follow protocol floor — no overrides
      engine.renderer.floorOverride = null;
      engine.renderer.smoothUpscale = true;
      engine.renderer.incTick();
      engine.renderer.draw(canvas.width, canvas.height);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const applyTo = (engine: NonNullable<typeof engineRef.current>, targetMs: number, isSeek = false) => {
    if (!engine.cam) return;
    if (isSeek) engine.parser.seekMode = true;
    debugLoggerRef.current.setCamMs(targetMs);
    
    const KEYFRAME_INTERVAL = 30000;
    
    while (engine.curFrame < engine.cam.frames.length) {
      const frame = engine.cam.frames[engine.curFrame];
      if (frame.timestamp > targetMs) break;
      try { engine.parser.process(frame.payload); } catch { /* skip */ }
      engine.curFrame++;
      
      if (!isSeek && frame.timestamp - engine.lastKeyframeMs >= KEYFRAME_INTERVAL) {
        engine.keyframes.push({
          ms: frame.timestamp,
          frameIdx: engine.curFrame,
          snap: engine.gs.snapshot(),
        });
        engine.lastKeyframeMs = frame.timestamp;
      }
    }
    engine.curMs = targetMs;
    if (isSeek) {
      engine.parser.seekMode = false;
      for (const [cid, c] of engine.gs.creatures.entries()) {
        c.walking = false;
        c.walkOffsetX = 0;
        c.walkOffsetY = 0;
        if (cid === engine.gs.playerId) continue;
        const tile = engine.gs.getTile(c.x, c.y, c.z);
        const onTile = tile.some(i => i[0] === 'cr' && i[1] === cid);
        if (!onTile) {
          if (c.x !== 0 || c.y !== 0 || c.z !== 0) {
            tile.push(['cr', cid]);
            engine.gs.setTile(c.x, c.y, c.z, tile);
          } else {
            engine.gs.creatures.delete(cid);
          }
        }
      }
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (ext !== '.cam') {
      setErrorMsg(t('camPlayer.invalidFormat'));
      setState('error');
      return;
    }

    const engine = engineRef.current;
    if (!engine) return;

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

      engine.gs.reset();
      engine.parser = createPacketParser(engine.gs, engine.dat);
      engine.parser.debugLogger = debugLoggerRef.current;
      engine.renderer.gs = engine.gs;
      engine.renderer.debugLogger = debugLoggerRef.current;
      engine.renderer.clearCache();
      debugLoggerRef.current.clear();
      engine.cam = cam;
      engine.curFrame = 0;
      engine.curMs = 0;
      engine.keyframes = [];
      engine.lastKeyframeMs = -Infinity;
      engine.renderer.floorOverride = null;

      applyTo(engine, 0, true);

      setDuration(cam.totalMs);
      setProgress(0);
      setState('paused');

      console.log(`[TibiarcPlayer] Loaded ${cam.frames.length} frames, ${(cam.totalMs / 1000).toFixed(1)}s, parser=u16`);

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
    const engine = engineRef.current;
    if (!engine || !engine.cam) return;

    if (state === 'paused') {
      engine.wallT0 = performance.now();
      engine.camT0Ms = engine.curMs;
      engine.speed = speed;
      engine.playing = true;
      setState('playing');
    } else if (state === 'playing') {
      engine.playing = false;
      setState('paused');
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 2, 4, 8];
    const currentIndex = speeds.indexOf(speed);
    const newSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(newSpeed);
    const engine = engineRef.current;
    if (engine && engine.playing) {
      engine.wallT0 = performance.now();
      engine.camT0Ms = engine.curMs;
      engine.speed = newSpeed;
    }
  };

  const handleSeek = (val: number[]) => {
    const ms = val[0];
    const engine = engineRef.current;
    if (!engine || !engine.cam) return;

    const wasPlaying = engine.playing;
    engine.playing = false;

    let bestKf: (typeof engine.keyframes)[number] | null = null;
    for (const kf of engine.keyframes) {
      if (kf.ms <= ms) bestKf = kf;
      else break;
    }

    if (bestKf) {
      engine.gs.restore(bestKf.snap);
      engine.parser = createPacketParser(engine.gs, engine.dat);
      engine.parser.debugLogger = debugLoggerRef.current;
      engine.renderer.gs = engine.gs;
      engine.curFrame = bestKf.frameIdx;
      engine.curMs = bestKf.ms;
    } else {
      engine.gs.reset();
      engine.parser = createPacketParser(engine.gs, engine.dat);
      engine.parser.debugLogger = debugLoggerRef.current;
      engine.renderer.gs = engine.gs;
      engine.curFrame = 0;
      engine.curMs = 0;
    }

    applyTo(engine, ms, true);
    setProgress(ms);

    if (wasPlaying) {
      engine.wallT0 = performance.now();
      engine.camT0Ms = ms;
      engine.speed = speed;
      engine.playing = true;
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
        className="relative w-full aspect-[15/11] max-w-[960px] mx-auto bg-black rounded-sm overflow-hidden border-2 border-border/50"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
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
              {state === 'loading-data' ? 'Carregando sprites e definições...' : `Carregando ${fileName}...`}
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
