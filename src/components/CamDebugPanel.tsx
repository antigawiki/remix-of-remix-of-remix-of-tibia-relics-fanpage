import { useState, useEffect, useRef, useCallback } from 'react';
import { Bug, Download, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DebugLogger, type DebugEventType, type DebugSnapshot } from '@/lib/tibiaRelic/debugLogger';

interface CamDebugPanelProps {
  loggerRef: React.RefObject<DebugLogger | null>;
  getSnapshot: () => DebugSnapshot | null;
}

const EVENT_COLORS: Record<DebugEventType, string> = {
  OPCODE: 'text-muted-foreground',
  MOVE_CR: 'text-blue-400',
  FLOOR_CHANGE: 'text-yellow-400',
  SYNC_PLAYER: 'text-cyan-400',
  PLAYER_POS: 'text-green-400',
  DESYNC: 'text-red-400 font-bold',
  WALK_FAIL: 'text-red-400 font-bold',
  TILE_UPDATE: 'text-purple-400',
  SCROLL: 'text-orange-400',
  MAP_DESC: 'text-emerald-400',
};

const ALL_TYPES: DebugEventType[] = [
  'MOVE_CR', 'FLOOR_CHANGE', 'DESYNC', 'WALK_FAIL',
  'SYNC_PLAYER', 'PLAYER_POS', 'SCROLL', 'MAP_DESC',
  'TILE_UPDATE', 'OPCODE',
];

const CamDebugPanel = ({ loggerRef, getSnapshot }: CamDebugPanelProps) => {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null);
  const [events, setEvents] = useState<ReturnType<DebugLogger['getFiltered']>>([]);
  const [filters, setFilters] = useState<Set<DebugEventType>>(new Set(['MOVE_CR', 'FLOOR_CHANGE', 'DESYNC', 'WALK_FAIL', 'SYNC_PLAYER', 'PLAYER_POS']));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Toggle debug mode
  const toggleOpen = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      const logger = loggerRef.current;
      if (logger) {
        logger.enabled = next;
        if (!next) logger.clear();
      }
      return next;
    });
  }, [loggerRef]);

  // Refresh at 5Hz
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => {
      const logger = loggerRef.current;
      if (!logger) return;
      setSnapshot(getSnapshot());
      setEvents([...logger.getFiltered(Array.from(filters))].slice(-200));
    }, 200);
    return () => clearInterval(iv);
  }, [open, loggerRef, getSnapshot, filters]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const toggleFilter = (type: DebugEventType) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleExport = () => {
    const logger = loggerRef.current;
    if (!logger) return;
    const text = logger.exportText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cam-debug-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-[960px] mx-auto">
      {/* Toggle button */}
      <Button
        variant={open ? 'default' : 'outline'}
        size="sm"
        onClick={toggleOpen}
        className={open ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-border/50'}
      >
        <Bug className="w-3.5 h-3.5 mr-1" />
        Debug {open ? 'ON' : 'OFF'}
      </Button>

      {open && (
        <div className="mt-2 bg-card border border-border/50 rounded-sm overflow-hidden">
          {/* Real-time indicators */}
          {snapshot && (
            <div className="p-3 border-b border-border/30 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div>
                <span className="text-muted-foreground">cam: </span>
                <span className="text-foreground">{snapshot.camX},{snapshot.camY},{snapshot.camZ}</span>
              </div>
              <div>
                <span className="text-muted-foreground">player: </span>
                <span className="text-foreground">{snapshot.playerX},{snapshot.playerY},{snapshot.playerZ}</span>
              </div>
              <div>
                <span className="text-muted-foreground">floor sync: </span>
                <span className={snapshot.playerOnCorrectFloor ? 'text-green-400' : 'text-red-400 font-bold animate-pulse'}>
                  {snapshot.playerOnCorrectFloor ? '✓ OK' : '✗ DESYNC'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">creatures: </span>
                <span className="text-foreground">{snapshot.creatureCount}</span>
              </div>
              {snapshot.lastMoveCr && (
                <div className="col-span-2 md:col-span-4">
                  <span className="text-muted-foreground">last moveCr: </span>
                  <span className="text-blue-400">
                    cid={String(snapshot.lastMoveCr.cid)} 
                    {' '}({String(snapshot.lastMoveCr.fromX)},{String(snapshot.lastMoveCr.fromY)},{String(snapshot.lastMoveCr.fromZ)})
                    →({String(snapshot.lastMoveCr.toX)},{String(snapshot.lastMoveCr.toY)},{String(snapshot.lastMoveCr.toZ)})
                    {' '}fallback={String(snapshot.lastMoveCr.fallback)}
                    {' '}walk={String(snapshot.lastMoveCr.walkAnimated)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="p-2 border-b border-border/30 flex flex-wrap gap-1 items-center">
            <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            {ALL_TYPES.map(type => (
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
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleExport}>
                <Download className="w-3 h-3 mr-1" />Export
              </Button>
            </div>
          </div>

          {/* Event list */}
          <div
            ref={scrollRef}
            className="h-[250px] overflow-y-auto p-2 font-mono text-[11px] leading-tight space-y-0.5 bg-background/50"
          >
            {events.length === 0 && (
              <div className="text-muted-foreground text-center py-8">
                Aguardando eventos... Carregue e reproduza uma .cam
              </div>
            )}
            {events.map((e, i) => {
              const isError = e.type === 'DESYNC' || e.type === 'WALK_FAIL';
              const time = (e.camMs / 1000).toFixed(2);
              const dataStr = Object.entries(e.data)
                .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join(' ');
              return (
                <div
                  key={i}
                  className={`${isError ? 'bg-red-900/20 border-l-2 border-red-500 pl-1' : ''} ${EVENT_COLORS[e.type] || 'text-foreground'}`}
                >
                  <span className="text-muted-foreground">[{time}s]</span>{' '}
                  <span className="font-bold">{e.type}</span>{' '}
                  {dataStr}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CamDebugPanel;
