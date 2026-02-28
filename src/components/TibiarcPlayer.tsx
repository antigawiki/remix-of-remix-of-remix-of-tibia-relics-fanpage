import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FastForward, RotateCcw, Loader2, ChevronUp, ChevronDown, Layers, Sparkles, Monitor, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { parseCamFile, type CamFile } from '@/lib/tibiaRelic/camParser';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { PacketParser } from '@/lib/tibiaRelic/packetParser';
import { GameState, type GameStateSnapshot } from '@/lib/tibiaRelic/gameState';
import { Renderer } from '@/lib/tibiaRelic/renderer';
import { extractMapTiles, type MapExtractionProgress, type MapExtractionResult } from '@/lib/tibiaRelic/mapExtractor';
import { supabase } from '@/integrations/supabase/client';


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
  const [floorOffset, setFloorOffset] = useState(0);
  const [qualityMode, setQualityMode] = useState<'classic' | 'enhanced'>('enhanced');
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<MapExtractionProgress | null>(null);
  const floorOffsetRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync with state for animation loop access
  useEffect(() => { floorOffsetRef.current = floorOffset; }, [floorOffset]);
  const qualityModeRef = useRef(qualityMode);
  useEffect(() => { qualityModeRef.current = qualityMode; }, [qualityMode]);

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
          // Throttle React state updates to ~10Hz to avoid jank
          if (!engine._lastProgressUpdate || now - engine._lastProgressUpdate > 100) {
            engine._lastProgressUpdate = now;
            setProgress(engine.curMs);
          }
        }
      }

      // Update floor override from ref to stay in sync
      const floorOffsetVal = floorOffsetRef.current;
      if (floorOffsetVal !== 0) {
        const player = engine.gs.creatures.get(engine.gs.playerId);
        const baseZ = player ? player.z : engine.gs.camZ;
        const targetZ = Math.max(0, Math.min(15, baseZ + floorOffsetVal));
        engine.renderer.floorOverride = targetZ;
      } else {
        engine.renderer.floorOverride = null;
      }

      engine.renderer.smoothUpscale = qualityModeRef.current === 'enhanced';
      engine.renderer.incTick();
      engine.renderer.draw(canvas.width, canvas.height);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const applyTo = (engine: NonNullable<typeof engineRef.current>, targetMs: number, isSeek = false) => {
    if (!engine.cam) return;
    if (isSeek) engine.parser.seekMode = true;
    
    const KEYFRAME_INTERVAL = 30000; // 30s
    
    while (engine.curFrame < engine.cam.frames.length) {
      const frame = engine.cam.frames[engine.curFrame];
      if (frame.timestamp > targetMs) break;
      try { engine.parser.process(frame.payload); } catch { /* skip */ }
      engine.curFrame++;
      
      // Save keyframes every 30s during normal (non-seek) playback
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
      // Clear walk animations, prune stale creatures, and re-insert missing ones
      for (const [cid, c] of engine.gs.creatures.entries()) {
        c.walking = false;
        c.walkOffsetX = 0;
        c.walkOffsetY = 0;
        // Remove orphaned creatures not on any tile (except player)
        if (cid === engine.gs.playerId) continue;
        const tile = engine.gs.getTile(c.x, c.y, c.z);
        const onTile = tile.some(i => i[0] === 'cr' && i[1] === cid);
        if (!onTile) {
          // If creature has a valid position, re-insert it on its tile
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

      // Reset game state
      engine.gs.reset();
      engine.parser = createPacketParser(engine.gs, engine.dat);
      engine.renderer.gs = engine.gs;
      engine.renderer.clearCache();
      engine.cam = cam;
      engine.curFrame = 0;
      engine.curMs = 0;
      engine.keyframes = [];
      engine.lastKeyframeMs = -Infinity;
      engine.renderer.floorOverride = null;
      setFloorOffset(0);

      // Apply first frames to get initial map
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

  const resetPlayback = () => {
    const engine = engineRef.current;
    if (!engine || !engine.cam) return;

    engine.playing = false;
    engine.gs.reset();
    engine.parser = createPacketParser(engine.gs, engine.dat);
    engine.renderer.gs = engine.gs;
    engine.curFrame = 0;
    engine.curMs = 0;
    engine.keyframes = [];
    engine.lastKeyframeMs = -Infinity;
    applyTo(engine, 0, true);

    setProgress(0);
    setFloorOffset(0);
    engine.renderer.floorOverride = null;
    setState('paused');
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

    // Find nearest keyframe before target
    let bestKf: (typeof engine.keyframes)[number] | null = null;
    for (const kf of engine.keyframes) {
      if (kf.ms <= ms) bestKf = kf;
      else break;
    }

    if (bestKf) {
      // Restore from keyframe instead of replaying from 0
      engine.gs.restore(bestKf.snap);
      engine.parser = createPacketParser(engine.gs, engine.dat);
      engine.renderer.gs = engine.gs;
      engine.curFrame = bestKf.frameIdx;
      engine.curMs = bestKf.ms;
    } else {
      // No keyframe available — replay from start
      engine.gs.reset();
      engine.parser = createPacketParser(engine.gs, engine.dat);
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

  const handleExtractMap = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !engine.cam) return;
    setExtracting(true);
    setExtractProgress(null);

    try {
      const result = await extractMapTiles(engine.cam, engine.dat, (p) => {
        setExtractProgress(p);
      });

      // Upload tiles to database in batches
      const tileEntries = Array.from(result.tiles.entries());
      const BATCH = 500;
      for (let i = 0; i < tileEntries.length; i += BATCH) {
        const batch = tileEntries.slice(i, i + BATCH).map(([key, items]) => {
          const [x, y, z] = key.split(',').map(Number);
          return { x, y, z, items, updated_at: new Date().toISOString() };
        });

        const { error } = await supabase
          .from('cam_map_tiles' as any)
          .upsert(batch as any, { onConflict: 'x,y,z' });

        if (error) {
          console.error('[MapExtract] Tiles upsert error:', error);
        }
      }

      // Upload creatures to database in batches
      const creatureEntries = Array.from(result.creatures.values());
      for (let i = 0; i < creatureEntries.length; i += BATCH) {
        const batch = creatureEntries.slice(i, i + BATCH).map(c => ({
          x: c.x, y: c.y, z: c.z,
          name: c.name,
          outfit_id: c.outfitId,
          direction: c.direction,
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('cam_map_creatures' as any)
          .upsert(batch as any, { onConflict: 'x,y,z,name' });

        if (error) {
          console.error('[MapExtract] Creatures upsert error:', error);
        }
      }

      console.log(`[MapExtract] Done: ${result.tiles.size} tiles, ${result.creatures.size} creatures uploaded`);
    } catch (err) {
      console.error('[MapExtract] Failed:', err);
    } finally {
      setExtracting(false);
      setExtractProgress(null);
    }
  }, []);

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
          style={{ imageRendering: qualityMode === 'classic' ? 'pixelated' : 'auto' }}
        />

        {/* Hidden file input - always in DOM */}
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
              onClick={resetPlayback}
              disabled={!hasRecording}
              className="border-border/50"
            >
              <RotateCcw className="w-4 h-4" />
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

          {/* Floor controls */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <Button
              variant="outline"
              size="icon"
              className="border-border/50 h-8 w-8"
              disabled={!hasRecording}
              onClick={() => setFloorOffset(prev => {
                const engine = engineRef.current;
                if (!engine) return prev;
                const newZ = engine.gs.camZ + prev - 1;
                return newZ >= 0 ? prev - 1 : prev;
              })}
              title="Floor acima"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Badge variant="outline" className="min-w-[70px] justify-center text-xs font-mono">
              {(() => {
                const realZ = engineRef.current ? Math.max(0, Math.min(15, engineRef.current.gs.camZ + floorOffset)) : null;
                if (realZ === null) return 'Floor ?';
                const display = 7 - realZ;
                return `Floor ${display > 0 ? '+' : ''}${display}`;
              })()}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="border-border/50 h-8 w-8"
              disabled={!hasRecording}
              onClick={() => setFloorOffset(prev => {
                const engine = engineRef.current;
                if (!engine) return prev;
                const newZ = engine.gs.camZ + prev + 1;
                return newZ <= 15 ? prev + 1 : prev;
              })}
              title="Floor abaixo"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            {floorOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setFloorOffset(0)}
              >
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quality toggle */}
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 min-w-[90px]"
              onClick={() => setQualityMode(prev => prev === 'classic' ? 'enhanced' : 'classic')}
              title={qualityMode === 'classic' ? 'Modo Clássico (DX5)' : 'Modo Enhanced (DX9)'}
            >
              {qualityMode === 'classic' ? (
                <><Monitor className="w-3 h-3 mr-1" />Classic</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1" />Enhanced</>
              )}
            </Button>
            {hasRecording && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Outra .cam
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gold/50 text-gold hover:bg-gold/10"
                  onClick={handleExtractMap}
                  disabled={extracting}
                >
                  {extracting ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{extractProgress ? `${extractProgress.percent}%` : 'Extraindo...'}</>
                  ) : (
                    <>🗺️ Extrair Mapa</>
                  )}
                </Button>
              </>
            )}
            {extracting && extractProgress && (
              <Progress value={extractProgress.percent} className="w-24 h-2" />
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
