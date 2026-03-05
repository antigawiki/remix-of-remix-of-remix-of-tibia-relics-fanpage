import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { MapTileRenderer } from '@/lib/tibiaRelic/mapTileRenderer';

interface SpriteSidebarProps {
  renderer: MapTileRenderer;
  selectedItemId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}

const ITEMS_PER_ROW = 6;
const ITEM_SIZE = 40;
const ROW_HEIGHT = ITEM_SIZE + 4;
const VISIBLE_BUFFER = 10; // extra rows above/below viewport

export const SpriteSidebar = ({ renderer, selectedItemId, onSelect, onClose }: SpriteSidebarProps) => {
  const [searchId, setSearchId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const maxId = renderer.getMaxItemId();

  // Build filtered list of item IDs
  const allIds: number[] = [];
  for (let i = 100; i <= maxId; i++) allIds.push(i);

  const filteredIds = searchId.trim()
    ? allIds.filter(id => String(id).includes(searchId.trim()))
    : allIds;

  // Pre-filter: only include items that have at least one valid sprite
  const validIds = useMemo(() => {
    return filteredIds.filter(id => {
      if (canvasRefs.current.has(id)) return canvasRefs.current.get(id) !== null;
      const rendered = renderer.renderSingleSprite(id);
      canvasRefs.current.set(id, rendered);
      return rendered !== null;
    });
  }, [filteredIds, renderer]);

  const totalRows = Math.ceil(validIds.length / ITEMS_PER_ROW);
  const totalHeight = totalRows * ROW_HEIGHT;

  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);

  const visibleIds = validIds.slice(startRow * ITEMS_PER_ROW, endRow * ITEMS_PER_ROW);

  const renderSprite = useCallback((canvas: HTMLCanvasElement, itemId: number) => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 32, 32);

    if (canvasRefs.current.has(itemId)) {
      const cached = canvasRefs.current.get(itemId)!;
      if (cached) ctx.drawImage(cached, 0, 0);
      return;
    }
    const rendered = renderer.renderSingleSprite(itemId);
    canvasRefs.current.set(itemId, rendered);
    if (rendered) ctx.drawImage(rendered, 0, 0);
  }, [renderer]);


  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setContainerHeight(e.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="absolute left-0 top-0 z-[1001] w-[280px] h-full bg-card border-r border-border/50 flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-border/50 flex items-center gap-2">
        <span className="text-xs font-bold text-gold">SPRITES</span>
        <span className="text-xs text-muted-foreground ml-auto">{validIds.length}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchId}
            onChange={e => { setSearchId(e.target.value); setScrollTop(0); }}
            placeholder="Buscar por ID..."
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Virtual grid */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: startRow * ROW_HEIGHT, left: 0, right: 0 }}>
            <div className="flex flex-wrap gap-1 p-1">
              {visibleIds.map(id => (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className={`relative flex flex-col items-center justify-center rounded border transition-colors ${
                    selectedItemId === id
                      ? 'border-gold bg-gold/20'
                      : 'border-border/30 hover:border-gold/50 bg-background/50'
                  }`}
                  style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
                  title={`ID: ${id}`}
                >
                  <canvas
                    width={32}
                    height={32}
                    className="pixelated"
                    style={{ imageRendering: 'pixelated', width: 28, height: 28 }}
                    ref={el => { if (el) renderSprite(el, id); }}
                  />
                  <span className="absolute bottom-0 right-0.5 text-[8px] text-muted-foreground leading-none">
                    {id}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected indicator */}
      {selectedItemId && (
        <div className="p-2 border-t border-border/50 flex items-center gap-2">
          <canvas
            width={32}
            height={32}
            className="pixelated border border-gold rounded"
            style={{ imageRendering: 'pixelated', width: 32, height: 32 }}
            ref={el => { if (el) renderSprite(el, selectedItemId); }}
          />
          <span className="text-xs text-muted-foreground">ID: {selectedItemId}</span>
        </div>
      )}
    </div>
  );
};
