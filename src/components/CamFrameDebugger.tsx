import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bug, Download, Filter, Pause, Play, Trash2, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { parseCamFile, type CamFile } from '@/lib/tibiaRelic/camParser';
import { GameState } from '@/lib/tibiaRelic/gameState';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { PacketParser } from '@/lib/tibiaRelic/packetParser';
import { DebugLogger, type DebugEvent, type DebugEventType } from '@/lib/tibiaRelic/debugLogger';

interface CamFrameDebuggerProps {
  camBuffer: Uint8Array | null;
  progress: number; // current playback ms from WASM
  isPlaying: boolean;
}

const EVENT_COLORS: Partial<Record<DebugEventType, string>> = {
  FRAME_START: 'text-muted-foreground/60',
  FRAME_END: 'text-muted-foreground/40',
  OPCODE: 'text-muted-foreground',
  MOVE_CR: 'text-blue-400',
  FLOOR_CHANGE: 'text-yellow-400',
  SYNC_PLAYER: 'text-cyan-400',
  PLAYER_POS: 'text-green-400',
  DESYNC: 'text-red-400 font-bold',
  WALK_FAIL: 'text-red-400 font-bold',
  PARSE_ERROR: 'text-red-500 font-bold',
  TILE_UPDATE: 'text-purple-400',
  SCROLL: 'text-orange-400',
  MAP_DESC: 'text-emerald-400',
  MAP_DESC_MINI: 'text-lime-400',
  CREATURE_ADD: 'text-sky-400',
  CREATURE_REMOVE: 'text-rose-400',
  MULTIFLOOR_STEP: 'text-teal-400',
  MULTIFLOOR_DONE: 'text-teal-300',
  MULTIFLOOR_EXHAUSTED: 'text-red-300',
};

const FILTER_TYPES: DebugEventType[] = [
  'FRAME_START', 'PARSE_ERROR', 'MOVE_CR', 'FLOOR_CHANGE',
  'DESYNC', 'WALK_FAIL', 'SYNC_PLAYER', 'PLAYER_POS',
  'SCROLL', 'MAP_DESC', 'CREATURE_ADD', 'CREATURE_REMOVE',
  'TILE_UPDATE', 'OPCODE',
];

const DEFAULT_FILTERS = new Set<DebugEventType>([
  'FRAME_START', 'PARSE_ERROR', 'MOVE_CR', 'FLOOR_CHANGE',
  'DESYNC', 'WALK_FAIL', 'SYNC_PLAYER', 'PLAYER_POS',
  'SCROLL', 'MAP_DESC', 'CREATURE_ADD', 'CREATURE_REMOVE',
]);

const OPCODE_NAMES: Record<number, string> = {
  0x0a: 'LOGIN',
  0x64: 'MAP_DESC',
  0x65: 'SCROLL_N',
  0x66: 'SCROLL_E',
  0x67: 'SCROLL_S',
  0x68: 'SCROLL_W',
  0x69: 'TILE_UPD',
  0x6a: 'ADD_THING',
  0x6b: 'CHG_THING',
  0x6c: 'DEL_THING',
  0x6d: 'MOVE_CR',
  0x6e: 'OPEN_CONT',
  0x78: 'INV_SET',
  0x82: 'WORLD_LIGHT',
  0x83: 'EFFECT',
  0x84: 'ANIM_TEXT',
  0x85: 'MISSILE',
  0x8c: 'CR_HEALTH',
  0x8e: 'CR_OUTFIT',
  0x9a: 'PLAYER_POS',
  0xa0: 'STATS',
  0xaa: 'TALK',
  0xb4: 'TEXT_MSG',
  0xbe: 'FLOOR_UP',
  0xbf: 'FLOOR_DOWN',
};

interface DriftResult {
  frameIdx: number;
  timestamp: number;
  bytesLeft: number;
  totalBytes: number;
  opcodes: string[];
  hexDump: string;
  error?: string;
}

const CamFrameDebugger = ({ camBuffer, progress, isPlaying }: CamFrameDebuggerProps) => {
  const [open, setOpen] = useState(false);
  const [pauseOnError, setPauseOnError] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filters, setFilters] = useState<Set<DebugEventType>>(new Set(DEFAULT_FILTERS));
  const [displayEvents, setDisplayEvents] = useState<DebugEvent[]>([]);
  const [stats, setStats] = useState({ frames: 0, errors: 0, walkFails: 0, creatures: 0, cam: '', player: '' });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drift scanner state
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [driftResults, setDriftResults] = useState<DriftResult[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const scanAbortRef = useRef(false);

  // Parser state refs
  const camFileRef = useRef<CamFile | null>(null);
  const parserRef = useRef<PacketParser | null>(null);
  const loggerRef = useRef<DebugLogger>(new DebugLogger());
  const lastFrameIdxRef = useRef(0);
  const datLoaderRef = useRef<DatLoader | null>(null);
  const datLoadedRef = useRef(false);

  // Load DAT file once
  useEffect(() => {
    if (datLoadedRef.current) return;
    datLoadedRef.current = true;
    fetch('/tibiarc/data/Tibia.dat')
      .then(r => r.arrayBuffer())
      .then(buf => {
        const dat = new DatLoader();
        dat.load(buf);
        datLoaderRef.current = dat;
        console.log('[CamFrameDebugger] DAT loaded');
      })
      .catch(e => console.error('[CamFrameDebugger] Failed to load DAT:', e));
  }, []);

  // Parse .cam file when buffer changes
  useEffect(() => {
    if (!camBuffer || !open) return;
    try {
      const cam = parseCamFile(camBuffer.buffer as ArrayBuffer);
      camFileRef.current = cam;
      lastFrameIdxRef.current = 0;
      console.log(`[CamFrameDebugger] Parsed ${cam.frames.length} frames, ${(cam.totalMs / 1000).toFixed(1)}s`);

      // Create fresh parser
      const gs = new GameState();
      const dat = datLoaderRef.current;
      if (!dat) return;
      const logger = new DebugLogger();
      logger.enabled = true;
      loggerRef.current = logger;
      const parser = new PacketParser(gs, dat, { looktypeU16: true });
      parser.debugLogger = logger;
      parser.seekMode = true; // suppress visual effects
      parserRef.current = parser;
    } catch (e) {
      console.error('[CamFrameDebugger] Failed to parse cam:', e);
    }
  }, [camBuffer, open]);

  // Process frames in sync with playback progress
  useEffect(() => {
    if (!open || frozen) return;
    const cam = camFileRef.current;
    const parser = parserRef.current;
    const logger = loggerRef.current;
    if (!cam || !parser || !logger) return;

    let idx = lastFrameIdxRef.current;
    let processedAny = false;

    while (idx < cam.frames.length && cam.frames[idx].timestamp <= progress) {
      const frame = cam.frames[idx];
      logger.setCamMs(frame.timestamp);

      // FRAME_START with first bytes hex dump for TCP demux diagnosis
      const firstBytes = Array.from(frame.payload.slice(0, Math.min(4, frame.payload.length)))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
      const tcpLen = frame.payload.length >= 2 ? (frame.payload[0] | (frame.payload[1] << 8)) : 0;
      logger.log('FRAME_START', { frameIdx: idx, bytes: frame.payload.length, hex: firstBytes, tcpLen },
        `Frame #${idx} (${frame.payload.length}B) first=[${firstBytes}] tcpLen=${tcpLen}`);

      try {
        // Track creatures before
        const crBefore = new Set(parser.gs.creatures.keys());

        parser.process(frame.payload);

        // Track new/removed creatures
        const crAfter = parser.gs.creatures;
        for (const [cid, cr] of crAfter) {
          if (!crBefore.has(cid)) {
            logger.log('CREATURE_ADD', { cid, name: cr.name, pos: `${cr.x},${cr.y},${cr.z}` },
              `New creature: ${cr.name || `#${cid}`} at (${cr.x},${cr.y},${cr.z})`);
          }
        }
        for (const oldCid of crBefore) {
          if (!crAfter.has(oldCid)) {
            logger.log('CREATURE_REMOVE', { cid: oldCid }, `Creature #${oldCid} removed`);
          }
        }

        // Annotate opcodes with human-readable names
        const opcodes = parser.lastFrameOpcodes;
        const opNames = opcodes.map(op => OPCODE_NAMES[op] || `0x${op.toString(16)}`);
        const bytesLeft = parser.bytesLeftAfterProcess;

        logger.log('FRAME_END', {
          opcodes: opNames.join(', '),
          bytesLeft,
          cam: `${parser.gs.camX},${parser.gs.camY},${parser.gs.camZ}`,
        }, bytesLeft > 0 ? `⚠ ${bytesLeft} bytes unconsumed` : `OK (${opcodes.length} ops)`);

        if (bytesLeft > 0) {
          // Log hex dump of remaining bytes
          const payload = frame.payload;
          const startPos = payload.length - bytesLeft;
          const hexBytes = Array.from(payload.slice(startPos, Math.min(startPos + 32, payload.length)))
            .map(b => b.toString(16).padStart(2, '0')).join(' ');
          logger.log('PARSE_ERROR', {
            type: 'BYTES_LEFTOVER',
            bytesLeft,
            hex: hexBytes,
            frameIdx: idx,
          }, `Leftover bytes at frame #${idx}: ${hexBytes}`);
        }
      } catch (e: any) {
        const msg = e?.message || String(e);
        const payload = frame.payload;
        const hexDump = Array.from(payload.slice(0, Math.min(64, payload.length)))
          .map(b => b.toString(16).padStart(2, '0')).join(' ');
        logger.log('PARSE_ERROR', {
          error: msg,
          frameIdx: idx,
          hex: hexDump,
        }, `⚠ PARSE ERROR at frame #${idx}: ${msg}`);

        if (pauseOnError) {
          setFrozen(true);
          break;
        }
      }

      idx++;
      processedAny = true;
    }

    lastFrameIdxRef.current = idx;

    if (processedAny) {
      const gs = parser.gs;
      setStats({
        frames: idx,
        errors: logger.events.filter(e => e.type === 'PARSE_ERROR').length,
        walkFails: logger.events.filter(e => e.type === 'WALK_FAIL').length,
        creatures: gs.creatures.size,
        cam: `${gs.camX},${gs.camY},${gs.camZ}`,
        player: gs.playerId ? (() => {
          const p = gs.creatures.get(gs.playerId);
          return p ? `${p.x},${p.y},${p.z}` : 'N/A';
        })() : 'N/A',
      });

      const filtered = logger.getFiltered(Array.from(filters)).slice(-300);
      setDisplayEvents(filtered);
    }
  }, [progress, open, frozen, filters, pauseOnError]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayEvents, autoScroll]);

  const toggleFilter = (type: DebugEventType) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleScanDrift = useCallback(async () => {
    if (!camBuffer || !datLoaderRef.current) return;
    
    const cam = parseCamFile(camBuffer.buffer as ArrayBuffer);
    const gs = new GameState();
    const parser = new PacketParser(gs, datLoaderRef.current, { looktypeU16: true, strictMode: true });
    parser.seekMode = true;
    
    setScanning(true);
    setScanDone(false);
    setDriftResults([]);
    setScanProgress(0);
    scanAbortRef.current = false;
    
    const results: DriftResult[] = [];
    const BATCH = 50; // frames per tick
    
    for (let i = 0; i < cam.frames.length; i += BATCH) {
      if (scanAbortRef.current) break;
      
      const end = Math.min(i + BATCH, cam.frames.length);
      for (let j = i; j < end; j++) {
        const frame = cam.frames[j];
        const opcodes: string[] = [];
        let bytesLeft = 0;
        let error: string | undefined;
        
        try {
          parser.process(frame.payload);
          bytesLeft = parser.bytesLeftAfterProcess;
          opcodes.push(...parser.lastFrameOpcodes.map(op => OPCODE_NAMES[op] || `0x${op.toString(16).padStart(2, '0')}`));
        } catch (e: any) {
          error = e?.message || String(e);
          bytesLeft = -1; // crash
          opcodes.push(...parser.lastFrameOpcodes.map(op => OPCODE_NAMES[op] || `0x${op.toString(16).padStart(2, '0')}`));
        }
        
        if (bytesLeft !== 0 || error) {
          // Hex dump of the problematic area
          const dumpStart = error ? 0 : Math.max(0, frame.payload.length - Math.abs(bytesLeft));
          const hexBytes = Array.from(frame.payload.slice(dumpStart, Math.min(dumpStart + 64, frame.payload.length)))
            .map(b => b.toString(16).padStart(2, '0')).join(' ');
          
          results.push({
            frameIdx: j,
            timestamp: frame.timestamp,
            bytesLeft,
            totalBytes: frame.payload.length,
            opcodes,
            hexDump: hexBytes,
            error,
          });
        }
      }
      
      setScanProgress(Math.round((end / cam.frames.length) * 100));
      // Yield to UI
      await new Promise(r => requestAnimationFrame(r));
    }
    
    setDriftResults(results);
    setScanning(false);
    setScanDone(true);
    console.log(`[DriftScan] Done. ${results.length} problematic frames out of ${cam.frames.length}`);
  }, [camBuffer]);

  const handleExport = () => {
    const logger = loggerRef.current;
    const text = logger.exportText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cam-frame-debug-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDrift = () => {
    const lines = driftResults.map(r => 
      `Frame #${r.frameIdx} @ ${(r.timestamp/1000).toFixed(2)}s | ${r.totalBytes}B | left=${r.bytesLeft} | ops=[${r.opcodes.join(',')}]${r.error ? ` | ERR: ${r.error}` : ''}\n  hex: ${r.hexDump}`
    );
    const text = `Drift Scan Results — ${driftResults.length} problematic frames\n${'='.repeat(60)}\n${lines.join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drift-scan-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    loggerRef.current.clear();
    setDisplayEvents([]);
    lastFrameIdxRef.current = 0;
    if (camBuffer && datLoaderRef.current) {
      const gs = new GameState();
      const logger = new DebugLogger();
      logger.enabled = true;
      loggerRef.current = logger;
      const parser = new PacketParser(gs, datLoaderRef.current, { looktypeU16: true });
      parser.debugLogger = logger;
      parser.seekMode = true;
      parserRef.current = parser;
    }
    setFrozen(false);
  };

  if (!open) {
    return (
      <div className="w-full max-w-[960px] mx-auto">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="border-border/50">
          <Bug className="w-3.5 h-3.5 mr-1" />
          Frame Debugger
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[960px] mx-auto space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="default" size="sm" onClick={() => { setOpen(false); setFrozen(false); }} className="bg-red-600 hover:bg-red-700 text-white">
          <Bug className="w-3.5 h-3.5 mr-1" />
          Debugger ON
        </Button>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Pause on error:</span>
          <Switch checked={pauseOnError} onCheckedChange={setPauseOnError} className="scale-75" />
        </div>
        {frozen && (
          <Badge variant="destructive" className="text-[10px] animate-pulse">
            FROZEN — Error detected
          </Badge>
        )}
        {frozen && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setFrozen(false)}>
            <Play className="w-3 h-3 mr-1" />Resume
          </Button>
        )}
      </div>

      <div className="bg-card border border-border/50 rounded-sm overflow-hidden">
        {/* Stats bar */}
        <div className="p-2 border-b border-border/30 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-mono">
          <div>
            <span className="text-muted-foreground">frames: </span>
            <span className="text-foreground">{stats.frames}</span>
          </div>
          <div>
            <span className="text-muted-foreground">errors: </span>
            <span className={stats.errors > 0 ? 'text-red-400 font-bold' : 'text-foreground'}>{stats.errors}</span>
          </div>
          <div>
            <span className="text-muted-foreground">walk_fails: </span>
            <span className={stats.walkFails > 0 ? 'text-yellow-400 font-bold' : 'text-foreground'}>{stats.walkFails}</span>
          </div>
          <div>
            <span className="text-muted-foreground">cam: </span>
            <span className="text-foreground">{stats.cam || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">player: </span>
            <span className="text-foreground">{stats.player || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">creatures: </span>
            <span className="text-foreground">{stats.creatures}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="p-2 border-b border-border/30 flex flex-wrap gap-1 items-center">
          <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {FILTER_TYPES.map(type => (
            <Badge
              key={type}
              variant={filters.has(type) ? 'default' : 'outline'}
              className={`cursor-pointer text-[10px] px-1.5 py-0 ${filters.has(type) ? '' : 'opacity-50'}`}
              onClick={() => toggleFilter(type)}
            >
              {type}
            </Badge>
          ))}
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? 'Auto↓ ON' : 'Auto↓ OFF'}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleClear}>
              <Trash2 className="w-3 h-3 mr-1" />Clear
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleExport}>
              <Download className="w-3 h-3 mr-1" />Export
            </Button>
          </div>
        </div>

        {/* Event list */}
        <div
          ref={scrollRef}
          className="h-[300px] overflow-y-auto p-2 font-mono text-[11px] leading-tight space-y-0.5 bg-background/50"
        >
          {displayEvents.length === 0 && (
            <div className="text-muted-foreground text-center py-8">
              Aguardando frames... Carregue e reproduza uma .cam
            </div>
          )}
          {displayEvents.map((e, i) => {
            const isError = e.type === 'PARSE_ERROR' || e.type === 'DESYNC' || e.type === 'WALK_FAIL';
            const isFrame = e.type === 'FRAME_START' || e.type === 'FRAME_END';
            const time = (e.camMs / 1000).toFixed(2);
            const colorClass = EVENT_COLORS[e.type] || 'text-foreground';

            if (e.description) {
              return (
                <div
                  key={i}
                  className={`${isError ? 'bg-red-900/20 border-l-2 border-red-500 pl-1' : ''} ${isFrame ? 'opacity-70' : ''} ${colorClass}`}
                >
                  <span className="text-muted-foreground">[{time}s]</span>{' '}
                  <span className="font-bold">{e.type}</span>{' '}
                  {e.description}
                </div>
              );
            }

            const dataStr = Object.entries(e.data)
              .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
              .join(' ');
            return (
              <div
                key={i}
                className={`${isError ? 'bg-red-900/20 border-l-2 border-red-500 pl-1' : ''} ${colorClass}`}
              >
                <span className="text-muted-foreground">[{time}s]</span>{' '}
                <span className="font-bold">{e.type}</span>{' '}
                {dataStr}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CamFrameDebugger;
