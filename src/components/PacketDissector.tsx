import { useState, useEffect, useRef, useCallback } from 'react';
import { Microscope, Download, Trash2, Filter, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { parseCamFile, type CamFile } from '@/lib/tibiaRelic/camParser';
import { GameState } from '@/lib/tibiaRelic/gameState';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { PacketParser } from '@/lib/tibiaRelic/packetParser';
import { DissectorBuffer, type DissectedFrame, type DissectedOpcode, getOpcodeName } from '@/lib/tibiaRelic/protocolDissector';

interface PacketDissectorProps {
  camBuffer: Uint8Array | null;
  progress: number;
  isPlaying: boolean;
}

const MAP_OPS = new Set([0x64, 0x65, 0x66, 0x67, 0x68, 0xbe, 0xbf]);
const POS_OPS = new Set([0x9a, 0x6d, 0x69, 0x6a, 0x6b, 0x6c]);
const IMPORTANT_OPS = new Set([...MAP_OPS, ...POS_OPS]);

type ViewMode = 'all' | 'map-only' | 'anomalies' | 'errors';

const PacketDissector = ({ camBuffer, progress, isPlaying }: PacketDissectorProps) => {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('map-only');
  const [autoScroll, setAutoScroll] = useState(true);
  const [frames, setFrames] = useState<DissectedFrame[]>([]);
  const [expandedFrames, setExpandedFrames] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState({ frames: 0, opcodes: 0, errors: 0, anomalies: 0, cam: '' });
  const scrollRef = useRef<HTMLDivElement>(null);

  const camFileRef = useRef<CamFile | null>(null);
  const parserRef = useRef<PacketParser | null>(null);
  const dissectorRef = useRef<DissectorBuffer>(new DissectorBuffer());
  const lastFrameIdxRef = useRef(0);
  const datLoaderRef = useRef<DatLoader | null>(null);
  const datLoadedRef = useRef(false);

  // Load DAT
  useEffect(() => {
    if (datLoadedRef.current) return;
    datLoadedRef.current = true;
    fetch('/tibiarc/data/Tibia.dat')
      .then(r => r.arrayBuffer())
      .then(buf => {
        const dat = new DatLoader();
        dat.load(buf);
        datLoaderRef.current = dat;
      })
      .catch(e => console.error('[PacketDissector] DAT load error:', e));
  }, []);

  // Parse cam file
  useEffect(() => {
    if (!camBuffer || !open) return;
    try {
      const cam = parseCamFile(camBuffer.buffer as ArrayBuffer);
      camFileRef.current = cam;
      lastFrameIdxRef.current = 0;

      const gs = new GameState();
      const dat = datLoaderRef.current;
      if (!dat) return;
      const dissector = new DissectorBuffer();
      dissectorRef.current = dissector;
      const parser = new PacketParser(gs, dat, { looktypeU16: true });
      parser.seekMode = true;
      parser.dissector = dissector;
      parserRef.current = parser;
      setFrames([]);
      setExpandedFrames(new Set());
    } catch (e) {
      console.error('[PacketDissector] Failed to parse cam:', e);
    }
  }, [camBuffer, open]);

  // Process frames
  useEffect(() => {
    if (!open) return;
    const cam = camFileRef.current;
    const parser = parserRef.current;
    const dissector = dissectorRef.current;
    if (!cam || !parser || !dissector) return;

    let idx = lastFrameIdxRef.current;
    let processedAny = false;

    while (idx < cam.frames.length && cam.frames[idx].timestamp <= progress) {
      const frame = cam.frames[idx];
      parser.dissectorFrameIdx = idx;
      parser.dissectorCamMs = frame.timestamp;

      try {
        parser.process(frame.payload);
      } catch (e: any) {
        // Frame error already captured by dissector
      }

      idx++;
      processedAny = true;
    }

    lastFrameIdxRef.current = idx;

    if (processedAny) {
      const gs = parser.gs;
      const allFrames = dissector.frames;
      const anomalies = dissector.getAnomalies();
      const errors = dissector.getIncompleteFrames();

      setStats({
        frames: allFrames.length,
        opcodes: allFrames.reduce((sum, f) => sum + f.opcodes.length, 0),
        errors: errors.length,
        anomalies: anomalies.length,
        cam: `${gs.camX},${gs.camY},${gs.camZ}`,
      });

      // Apply view filter
      let filtered: DissectedFrame[];
      switch (viewMode) {
        case 'map-only':
          filtered = allFrames.filter(f => f.opcodes.some(op => MAP_OPS.has(op.opcode) || POS_OPS.has(op.opcode))).slice(-100);
          break;
        case 'anomalies':
          filtered = allFrames.filter(f => f.opcodes.some(op => op.camBefore !== op.camAfter || op.error)).slice(-100);
          break;
        case 'errors':
          filtered = allFrames.filter(f => f.bytesLeft > 0 || f.error).slice(-100);
          break;
        default:
          filtered = allFrames.slice(-100);
      }
      setFrames(filtered);
    }
  }, [progress, open, viewMode]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [frames, autoScroll]);

  const toggleFrame = (frameIdx: number) => {
    setExpandedFrames(prev => {
      const next = new Set(prev);
      if (next.has(frameIdx)) next.delete(frameIdx);
      else next.add(frameIdx);
      return next;
    });
  };

  const handleExport = () => {
    const text = dissectorRef.current.exportText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packet-dissector-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    dissectorRef.current.clear();
    setFrames([]);
    lastFrameIdxRef.current = 0;
    setExpandedFrames(new Set());
    if (camBuffer && datLoaderRef.current) {
      const gs = new GameState();
      const dissector = new DissectorBuffer();
      dissectorRef.current = dissector;
      const parser = new PacketParser(gs, datLoaderRef.current, { looktypeU16: true });
      parser.seekMode = true;
      parser.dissector = dissector;
      parserRef.current = parser;
    }
  };

  if (!open) {
    return (
      <div className="w-full max-w-[960px] mx-auto">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="border-border/50">
          <Microscope className="w-3.5 h-3.5 mr-1" />
          Packet Dissector
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[960px] mx-auto space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="default" size="sm" onClick={() => setOpen(false)} className="bg-emerald-700 hover:bg-emerald-800 text-white">
          <Microscope className="w-3.5 h-3.5 mr-1" />
          Dissector ON
        </Button>
      </div>

      <div className="bg-card border border-border/50 rounded-sm overflow-hidden">
        {/* Stats bar */}
        <div className="p-2 border-b border-border/30 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-mono">
          <div><span className="text-muted-foreground">frames: </span><span>{stats.frames}</span></div>
          <div><span className="text-muted-foreground">opcodes: </span><span>{stats.opcodes}</span></div>
          <div>
            <span className="text-muted-foreground">errors: </span>
            <span className={stats.errors > 0 ? 'text-red-400 font-bold' : ''}>{stats.errors}</span>
          </div>
          <div>
            <span className="text-muted-foreground">cam_changes: </span>
            <span className={stats.anomalies > 0 ? 'text-yellow-400 font-bold' : ''}>{stats.anomalies}</span>
          </div>
          <div><span className="text-muted-foreground">cam: </span><span>{stats.cam || '-'}</span></div>
        </div>

        {/* View mode + controls */}
        <div className="p-2 border-b border-border/30 flex flex-wrap gap-1 items-center">
          <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {(['all', 'map-only', 'anomalies', 'errors'] as ViewMode[]).map(mode => (
            <Badge
              key={mode}
              variant={viewMode === mode ? 'default' : 'outline'}
              className={`cursor-pointer text-[10px] px-1.5 py-0 ${viewMode === mode ? '' : 'opacity-50'}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'all' ? 'ALL' : mode === 'map-only' ? 'MAP/POS' : mode === 'anomalies' ? 'CAM CHANGES' : 'ERRORS'}
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

        {/* Frame list */}
        <div
          ref={scrollRef}
          className="h-[400px] overflow-y-auto p-2 font-mono text-[11px] leading-tight space-y-1 bg-background/50"
        >
          {frames.length === 0 && (
            <div className="text-muted-foreground text-center py-8">
              Aguardando frames... Carregue e reproduza uma .cam
            </div>
          )}
          {frames.map((f) => {
            const expanded = expandedFrames.has(f.frameIdx);
            const hasError = f.bytesLeft > 0 || !!f.error;
            const hasCamChange = f.opcodes.some(op => op.camBefore !== op.camAfter);
            const time = (f.camMs / 1000).toFixed(2);

            return (
              <div key={f.frameIdx} className={`border-l-2 ${hasError ? 'border-red-500 bg-red-900/10' : hasCamChange ? 'border-yellow-500 bg-yellow-900/5' : 'border-border/30'}`}>
                {/* Frame header */}
                <div
                  className="flex items-center gap-1 px-1 py-0.5 cursor-pointer hover:bg-muted/30"
                  onClick={() => toggleFrame(f.frameIdx)}
                >
                  {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  <span className="text-muted-foreground">[{time}s]</span>
                  <span className="text-foreground font-bold">F#{f.frameIdx}</span>
                  <span className="text-muted-foreground">{f.totalBytes}B</span>
                  <span className="text-muted-foreground">{f.opcodes.length} ops</span>
                  {f.bytesLeft > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0">⚠ {f.bytesLeft}B left</Badge>}
                  {f.error && <Badge variant="destructive" className="text-[9px] px-1 py-0">ERR</Badge>}
                  {/* Show opcode summary */}
                  <span className="text-muted-foreground/60 ml-1 truncate">
                    {f.opcodes.map(op => op.opName).join(' → ')}
                  </span>
                </div>

                {/* Expanded: show each opcode */}
                {expanded && (
                  <div className="pl-4 space-y-0.5 pb-1">
                    {f.opcodes.map((op, i) => (
                      <OpcodeRow key={i} op={op} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Single opcode row with hex dump and decoded fields */
const OpcodeRow = ({ op }: { op: DissectedOpcode }) => {
  const [showHex, setShowHex] = useState(false);
  const camChanged = op.camBefore !== op.camAfter;
  const playerChanged = op.playerBefore !== op.playerAfter;

  const colorClass = op.isMapOp
    ? 'text-emerald-400'
    : POS_OPS.has(op.opcode)
      ? 'text-cyan-400'
      : op.error
        ? 'text-red-400'
        : 'text-muted-foreground';

  return (
    <div className={`${op.error ? 'bg-red-900/20' : ''}`}>
      <div className="flex items-center gap-1 flex-wrap">
        <span
          className={`font-bold cursor-pointer hover:underline ${colorClass}`}
          onClick={() => setShowHex(!showHex)}
          title="Click to toggle hex dump"
        >
          {op.opName}
        </span>
        <span className="text-muted-foreground/50">@{op.posBefore}</span>
        <span className="text-muted-foreground/50">{op.bytesConsumed}B</span>
        {camChanged && (
          <span className="text-yellow-400">
            cam:{op.camBefore}→{op.camAfter}
          </span>
        )}
        {playerChanged && (
          <span className="text-cyan-400">
            player:{op.playerBefore}→{op.playerAfter}
          </span>
        )}
        {op.error && (
          <span className="text-red-400 flex items-center gap-0.5">
            <AlertTriangle className="w-3 h-3" />
            {op.error}
          </span>
        )}
      </div>
      {showHex && (
        <div className="pl-2 text-[10px] text-muted-foreground/70 break-all select-all">
          {op.hexDump}
        </div>
      )}
    </div>
  );
};

export default PacketDissector;
