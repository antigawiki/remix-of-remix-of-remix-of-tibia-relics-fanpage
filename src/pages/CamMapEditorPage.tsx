import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon, ChevronUp, ChevronDown, Loader2, Search, Plus, Trash2, Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { MapTileRenderer, type TileData, type SpawnRenderData } from '@/lib/tibiaRelic/mapTileRenderer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER_X = 32369;
const DEFAULT_CENTER_Y = 32241;
const DEFAULT_Z = 7;
const CHUNK_TILES = 8;
const DB_CHUNK = 8;
const PAGE_SIZE = 1000;
const SIDEBAR_COLS = 6;
const SPRITE_SIZE = 40; // 32px sprite + 8px padding
const VIRTUAL_BUFFER = 20; // extra rows to render above/below viewport

async function loadChunks(
  z: number,
  onProgress: (label: string, count: number) => void,
): Promise<Map<string, TileData[]>> {
  const tileMap = new Map<string, TileData[]>();
  let offset = 0;
  let totalTiles = 0;
  while (true) {
    const { data, error } = await supabase
      .from('cam_map_chunks' as any)
      .select('chunk_x, chunk_y, z, tiles_data')
      .eq('z', z)
      .order('chunk_x', { ascending: true })
      .order('chunk_y', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data as any[]) {
      const tilesData = row.tiles_data as Record<string, number[]>;
      if (!tilesData) continue;
      const key = `${row.chunk_x},${row.chunk_y}`;
      const arr: TileData[] = [];
      for (const [relKey, itemIds] of Object.entries(tilesData)) {
        const [relXStr, relYStr] = relKey.split(',');
        const relX = parseInt(relXStr, 10);
        const relY = parseInt(relYStr, 10);
        if (isNaN(relX) || isNaN(relY)) continue;
        const absX = row.chunk_x * DB_CHUNK + relX;
        const absY = row.chunk_y * DB_CHUNK + relY;
        arr.push({ x: absX, y: absY, z, items: itemIds });
        totalTiles++;
      }
      if (arr.length > 0) tileMap.set(key, arr);
    }
    onProgress('tiles', totalTiles);
    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  return tileMap;
}

async function loadBelowChunkKeys(z: number): Promise<Set<string>> {
  const keys = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('cam_map_chunks' as any)
      .select('chunk_x, chunk_y')
      .eq('z', z)
      .order('chunk_x', { ascending: true })
      .order('chunk_y', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data as any[]) {
      keys.add(`${row.chunk_x},${row.chunk_y}`);
    }
    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  return keys;
}

// ─── Sprite Catalog Item ───
const SpriteCell = ({
  itemId,
  renderer,
  selected,
  onClick,
}: {
  itemId: number;
  renderer: MapTileRenderer;
  selected: boolean;
  onClick: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, 32, 32);
    const sprite = renderer.renderSingleSprite(itemId);
    if (sprite) ctx.drawImage(sprite, 0, 0);
  }, [itemId, renderer]);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center p-0.5 rounded cursor-pointer transition-all ${
        selected ? 'ring-2 ring-gold bg-gold/10' : 'hover:bg-muted/50'
      }`}
      title={`Item #${itemId}`}
    >
      <canvas ref={canvasRef} width={32} height={32} className="pixelated" />
      <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{itemId}</span>
    </button>
  );
};

// ─── Tile Edit Panel ───
const TileEditPanel = ({
  tileX,
  tileY,
  tileZ,
  items,
  selectedItemId,
  renderer,
  onSave,
  onClose,
}: {
  tileX: number;
  tileY: number;
  tileZ: number;
  items: number[];
  selectedItemId: number | null;
  renderer: MapTileRenderer;
  onSave: (newItems: number[]) => void;
  onClose: () => void;
}) => {
  const [localItems, setLocalItems] = useState<number[]>(items);
  const [saving, setSaving] = useState(false);

  useEffect(() => setLocalItems(items), [items]);

  const handleAdd = () => {
    if (selectedItemId == null) return;
    setLocalItems(prev => [...prev, selectedItemId]);
  };

  const handleReplaceAll = () => {
    if (selectedItemId == null) return;
    setLocalItems([selectedItemId]);
  };

  const handleRemove = (index: number) => {
    setLocalItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert to cam_map_tiles with seen_count=999 (manual edit protection)
      const { error } = await supabase
        .from('cam_map_tiles')
        .upsert(
          { x: tileX, y: tileY, z: tileZ, items: localItems as any, seen_count: 999 },
          { onConflict: 'x,y,z' }
        );
      if (error) throw error;

      // Also update cam_map_chunks so viewer sees changes immediately
      const chunkX = Math.floor(tileX / CHUNK_TILES);
      const chunkY = Math.floor(tileY / CHUNK_TILES);
      const relX = tileX - chunkX * CHUNK_TILES;
      const relY = tileY - chunkY * CHUNK_TILES;

      const { data: chunkData } = await (supabase
        .from('cam_map_chunks' as any)
        .select('tiles_data')
        .eq('chunk_x', chunkX)
        .eq('chunk_y', chunkY)
        .eq('z', tileZ)
        .maybeSingle() as any);

      const tilesData = ((chunkData as any)?.tiles_data as Record<string, number[]>) || {};
      tilesData[`${relX},${relY}`] = localItems;

      await supabase
        .from('cam_map_chunks')
        .upsert(
          { chunk_x: chunkX, chunk_y: chunkY, z: tileZ, tiles_data: tilesData as any },
          { onConflict: 'chunk_x,chunk_y,z' }
        );

      onSave(localItems);
      toast.success(`Tile (${tileX}, ${tileY}) salvo!`);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] bg-card border border-border rounded-md shadow-lg p-4 min-w-[300px] max-w-[400px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">
          Tile ({tileX}, {tileY}, {tileZ})
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
      </div>

      <div className="text-xs text-muted-foreground mb-2">Items atuais ({localItems.length}):</div>
      <div className="flex flex-wrap gap-1 mb-3 max-h-[120px] overflow-y-auto">
        {localItems.map((id, i) => {
          const canvasRef = useRef<HTMLCanvasElement>(null);
          useEffect(() => {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d')!;
            ctx.clearRect(0, 0, 32, 32);
            const spr = renderer.renderSingleSprite(id);
            if (spr) ctx.drawImage(spr, 0, 0);
          }, [id]);
          return (
            <div key={`${id}-${i}`} className="relative group">
              <canvas ref={canvasRef} width={32} height={32} className="pixelated border border-border/50 rounded" />
              <span className="text-[8px] text-muted-foreground absolute bottom-0 left-0 bg-card/80 px-0.5">{id}</span>
              <button
                onClick={() => handleRemove(i)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3.5 h-3.5 text-[8px] hidden group-hover:flex items-center justify-center"
              >
                ×
              </button>
            </div>
          );
        })}
        {localItems.length === 0 && <span className="text-xs text-muted-foreground italic">Vazio</span>}
      </div>

      {selectedItemId != null && (
        <div className="border-t border-border/50 pt-2 mb-3">
          <div className="text-xs text-muted-foreground mb-1">Item selecionado: #{selectedItemId}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleAdd} className="text-xs gap-1">
              <Plus className="w-3 h-3" /> Adicionar
            </Button>
            <Button size="sm" variant="outline" onClick={handleReplaceAll} className="text-xs gap-1">
              <Replace className="w-3 h-3" /> Substituir tudo
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs">
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};

// ─── Main Editor Page ───
const CamMapEditorPage = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.GridLayer | null>(null);
  const rendererRef = useRef<MapTileRenderer | null>(null);
  const floorDataRef = useRef<Map<string, TileData[]>>(new Map());
  const belowChunksRef = useRef<Set<string>>(new Set());
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [currentFloor, setCurrentFloor] = useState(DEFAULT_Z);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [floorLoading, setFloorLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchId, setSearchId] = useState('');
  const [maxItemId, setMaxItemId] = useState(3000);
  const [scrollTop, setScrollTop] = useState(0);
  const [editingTile, setEditingTile] = useState<{ x: number; y: number; z: number; items: number[] } | null>(null);

  // Load assets
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [sprRes, datRes] = await Promise.all([
        fetch('/tibiarc/data/Tibia.spr'),
        fetch('/tibiarc/data/Tibia.dat'),
      ]);
      if (!sprRes.ok || !datRes.ok) throw new Error('Data files not found');
      const [sprBuf, datBuf] = await Promise.all([sprRes.arrayBuffer(), datRes.arrayBuffer()]);
      if (cancelled) return;
      const spr = new SprLoader();
      spr.load(sprBuf);
      const dat = new DatLoader();
      dat.load(datBuf);
      const r = new MapTileRenderer(spr, dat);
      rendererRef.current = r;
      setMaxItemId(r.getMaxItemId());
      setAssetsLoading(false);
    };
    load().catch(console.error);
    return () => { cancelled = true; };
  }, []);

  // Load floor
  useEffect(() => {
    if (assetsLoading) return;
    let cancelled = false;
    setFloorLoading(true);
    Promise.all([
      loadChunks(currentFloor, (l, c) => { if (!cancelled) setLoadingStatus(`${c.toLocaleString()} ${l}`); }),
      currentFloor <= 14 ? loadBelowChunkKeys(currentFloor + 1) : Promise.resolve(new Set<string>()),
    ]).then(([tileMap, below]) => {
      if (cancelled) return;
      floorDataRef.current = tileMap;
      belowChunksRef.current = below;
      setFloorLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentFloor, assetsLoading]);

  const getChunkTiles = useCallback((cx: number, cy: number): TileData[] => {
    return floorDataRef.current.get(`${cx},${cy}`) || [];
  }, []);

  const getExternalTileUrl = useCallback((z: number, x: number, y: number, floor: number) => {
    return `https://st54085.ispot.cc/mapper/tibiarelic/${z + 3}/${floor}/${x}_${y}.png`;
  }, []);

  // Init Leaflet
  useEffect(() => {
    if (assetsLoading || !mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: 0,
      maxZoom: 5,
      zoomControl: true,
      attributionControl: false,
    });
    map.setView([-DEFAULT_CENTER_Y, DEFAULT_CENTER_X], 3);
    mapRef.current = map;

    // Leaflet needs a size recalc after flex layout settles
    setTimeout(() => map.invalidateSize(), 100);

    // Click to edit tile
    map.on('click', (e: L.LeafletMouseEvent) => {
      const tileX = Math.floor(e.latlng.lng);
      const tileY = Math.floor(-e.latlng.lat);
      const cx = Math.floor(tileX / CHUNK_TILES);
      const cy = Math.floor(tileY / CHUNK_TILES);
      const chunkTiles = floorDataRef.current.get(`${cx},${cy}`);
      const tile = chunkTiles?.find(t => t.x === tileX && t.y === tileY);
      setEditingTile({
        x: tileX,
        y: tileY,
        z: currentFloor,
        items: tile ? [...tile.items] : [],
      });
    });

    return () => { map.remove(); mapRef.current = null; tileLayerRef.current = null; };
  }, [assetsLoading]);

  // Update currentFloor ref for click handler
  const currentFloorRef = useRef(currentFloor);
  currentFloorRef.current = currentFloor;

  // Tile layer
  useEffect(() => {
    const map = mapRef.current;
    const renderer = rendererRef.current;
    if (!map || !renderer || floorLoading) return;

    if (tileLayerRef.current) { map.removeLayer(tileLayerRef.current); tileLayerRef.current = null; }
    renderer.invalidateFloor(currentFloor);
    const floor = currentFloor;

    const CustomTileLayer = L.GridLayer.extend({
      createTile(coords: L.Coords, done: L.DoneCallback) {
        const tile = document.createElement('canvas');
        tile.width = 256; tile.height = 256;
        const ctx = tile.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0, 256, 256); drawCamData(ctx, coords); (done as any)(null, tile); };
        img.onerror = () => { drawCamData(ctx, coords); (done as any)(null, tile); };
        img.src = getExternalTileUrl(coords.z, coords.x, coords.y, floor);

        function collectBorderTiles(cx: number, cy: number): TileData[] {
          const border: TileData[] = [];
          const baseX = cx * CHUNK_TILES, baseY = cy * CHUNK_TILES;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const neighborTiles = getChunkTiles(cx + dx, cy + dy);
              for (const t of neighborTiles) {
                const relX = t.x - baseX, relY = t.y - baseY;
                if (relX >= -2 && relX < CHUNK_TILES + 2 && relY >= -2 && relY < CHUNK_TILES + 2) border.push(t);
              }
            }
          }
          return border;
        }

        function drawCamData(c: CanvasRenderingContext2D, co: L.Coords) {
          const chunksPerTile = Math.pow(2, 5 - co.z);
          const baseChunkX = co.x * chunksPerTile, baseChunkY = co.y * chunksPerTile;
          const below = belowChunksRef.current;
          const opts = below.size > 0 ? { belowChunks: below } : undefined;

          if (chunksPerTile === 1) {
            const tiles = getChunkTiles(baseChunkX, baseChunkY);
            const border = collectBorderTiles(baseChunkX, baseChunkY);
            if (tiles.length > 0) {
              const rendered = renderer.renderChunk(baseChunkX, baseChunkY, floor, tiles, undefined, [], opts, border);
              if (rendered) c.drawImage(rendered, 0, 0, 256, 256);
            }
          } else {
            const chunkPx = 256 / chunksPerTile;
            for (let cy = 0; cy < chunksPerTile; cy++) {
              for (let cx = 0; cx < chunksPerTile; cx++) {
                const tcx = baseChunkX + cx, tcy = baseChunkY + cy;
                const tiles = getChunkTiles(tcx, tcy);
                const border = collectBorderTiles(tcx, tcy);
                if (tiles.length > 0) {
                  const rendered = renderer.renderChunk(tcx, tcy, floor, tiles, undefined, [], opts, border);
                  if (rendered) c.drawImage(rendered, cx * chunkPx, cy * chunkPx, chunkPx, chunkPx);
                }
              }
            }
          }
        }
        return tile;
      },
    });

    const layer = new (CustomTileLayer as any)({ tileSize: 256, minZoom: 0, maxZoom: 5, noWrap: true }) as L.GridLayer;
    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [currentFloor, floorLoading, getChunkTiles, getExternalTileUrl]);

  // Handle save from edit panel
  const handleTileSave = useCallback((newItems: number[]) => {
    if (!editingTile) return;
    const { x, y, z } = editingTile;
    const cx = Math.floor(x / CHUNK_TILES);
    const cy = Math.floor(y / CHUNK_TILES);
    const key = `${cx},${cy}`;

    // Update local floorData
    let chunkTiles = floorDataRef.current.get(key);
    if (!chunkTiles) { chunkTiles = []; floorDataRef.current.set(key, chunkTiles); }
    const idx = chunkTiles.findIndex(t => t.x === x && t.y === y);
    if (idx >= 0) {
      chunkTiles[idx] = { x, y, z, items: newItems };
    } else {
      chunkTiles.push({ x, y, z, items: newItems });
    }

    // Re-render affected chunk
    rendererRef.current?.invalidateFloor(z);
    if (tileLayerRef.current) tileLayerRef.current.redraw();

    setEditingTile(prev => prev ? { ...prev, items: newItems } : null);
  }, [editingTile]);

  // Sidebar virtual scroll
  const filteredIds = useMemo(() => {
    const start = 100;
    const ids: number[] = [];
    if (searchId) {
      const searchNum = parseInt(searchId, 10);
      if (!isNaN(searchNum) && searchNum >= start && searchNum <= maxItemId) {
        // Show range around searched ID
        const from = Math.max(start, searchNum - 30);
        const to = Math.min(maxItemId, searchNum + 60);
        for (let i = from; i <= to; i++) ids.push(i);
      }
    } else {
      for (let i = start; i <= maxItemId; i++) ids.push(i);
    }
    return ids;
  }, [searchId, maxItemId]);

  const totalRows = Math.ceil(filteredIds.length / SIDEBAR_COLS);
  const rowHeight = SPRITE_SIZE;
  const totalHeight = totalRows * rowHeight;

  const visibleRange = useMemo(() => {
    const containerH = 600; // approx
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_BUFFER);
    const endRow = Math.min(totalRows, Math.ceil((scrollTop + containerH) / rowHeight) + VIRTUAL_BUFFER);
    return { startRow, endRow };
  }, [scrollTop, totalRows, rowHeight]);

  const visibleIds = useMemo(() => {
    const start = visibleRange.startRow * SIDEBAR_COLS;
    const end = visibleRange.endRow * SIDEBAR_COLS;
    return filteredIds.slice(start, end);
  }, [filteredIds, visibleRange]);

  const floorDisplay = 7 - currentFloor;
  const isLoading = assetsLoading || floorLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/f9a2c8d4e7b1" className="text-gold hover:text-gold/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-gold" />
            <h1 className="font-heading text-lg text-gold">Tile Editor</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - sprite catalog */}
        <div className="w-[280px] border-r border-border/50 bg-card flex flex-col">
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Buscar por ID..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
            {selectedItemId != null && (
              <div className="mt-1.5 text-xs text-gold">Selecionado: #{selectedItemId}</div>
            )}
          </div>

          {!assetsLoading && rendererRef.current ? (
            <div
              ref={sidebarRef}
              className="flex-1 overflow-y-auto"
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            >
              <div style={{ height: totalHeight, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: visibleRange.startRow * rowHeight,
                    left: 0,
                    right: 0,
                  }}
                >
                  <div className="grid grid-cols-6 gap-0.5 px-1">
                    {visibleIds.map((id) => (
                      <SpriteCell
                        key={id}
                        itemId={id}
                        renderer={rendererRef.current!}
                        selected={selectedItemId === id}
                        onClick={() => setSelectedItemId(id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gold animate-spin" />
            </div>
          )}
        </div>

        {/* Map area */}
        <div className="flex-1 relative">
          {assetsLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
                <p className="text-sm text-muted-foreground">Carregando sprites...</p>
              </div>
            </div>
          ) : (
            <div ref={mapContainerRef} className="absolute inset-0" style={{ background: '#1a2420' }} />
          )}

          {!assetsLoading && floorLoading && (
            <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 w-64">
                <Loader2 className="w-6 h-6 text-gold animate-spin" />
                <p className="text-sm text-muted-foreground">Carregando andar... {loadingStatus}</p>
                <Progress value={undefined} className="w-full h-2" />
              </div>
            </div>
          )}

          {/* Floor controls */}
          {!isLoading && (
            <div className="absolute top-4 right-4 z-[1000] flex flex-col items-center gap-2 bg-card/90 border border-border/50 rounded-sm p-2">
              <Button
                variant="outline"
                size="icon"
                className="border-border/50 h-8 w-8"
                onClick={() => setCurrentFloor(prev => Math.max(0, prev - 1))}
                disabled={currentFloor <= 0}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Badge variant="outline" className="min-w-[60px] justify-center text-xs font-mono">
                {floorDisplay > 0 ? `+${floorDisplay}` : floorDisplay}
              </Badge>
              <Button
                variant="outline"
                size="icon"
                className="border-border/50 h-8 w-8"
                onClick={() => setCurrentFloor(prev => Math.min(15, prev + 1))}
                disabled={currentFloor >= 15}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Tile edit panel */}
          {editingTile && rendererRef.current && (
            <TileEditPanel
              tileX={editingTile.x}
              tileY={editingTile.y}
              tileZ={editingTile.z}
              items={editingTile.items}
              selectedItemId={selectedItemId}
              renderer={rendererRef.current}
              onSave={handleTileSave}
              onClose={() => setEditingTile(null)}
            />
          )}

          {/* Instructions overlay */}
          {!isLoading && !editingTile && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-card/90 border border-border/50 rounded-sm px-3 py-1.5">
              <span className="text-xs text-muted-foreground">
                Selecione um sprite à esquerda, depois clique no mapa para editar
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CamMapEditorPage;
