import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon, ChevronUp, ChevronDown, Loader2, Bug, Package, Pencil, Plus, Replace, Eraser, Save } from 'lucide-react';
import { SpriteSidebar } from '@/components/cam-editor/SpriteSidebar';
import { TileEditPanel } from '@/components/cam-editor/TileEditPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from '@/i18n';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { MapTileRenderer, type TileData, type CreatureData, type SpawnRenderData } from '@/lib/tibiaRelic/mapTileRenderer';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER_X = 32369;
const DEFAULT_CENTER_Y = 32241;
const DEFAULT_Z = 7;
const CHUNK_TILES = 8; // renderer chunk size (8x8 tiles = 256px)
const DB_CHUNK = 8;   // database chunk size (8x8 tiles, matches renderer)
const SPAWN_DB_CHUNK = 32; // spawns are stored in 32x32 chunks
const PAGE_SIZE = 1000;

/** Load spawns for a floor. */
async function loadSpawns(
  z: number,
  onProgress: (label: string, count: number) => void,
): Promise<Map<string, SpawnRenderData[]>> {
  const spawnMap = new Map<string, SpawnRenderData[]>();
  let offset = 0;
  let total = 0;
  while (true) {
    const { data, error } = await supabase
      .from('cam_map_spawns' as any)
      .select('chunk_x, chunk_y, z, creature_name, outfit_id, avg_count, positions')
      .eq('z', z)
      .order('chunk_x', { ascending: true })
      .order('chunk_y', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data as any[]) {
      // Map DB chunk (32x32) spawns to render chunks (8x8)
      // Each DB chunk contains 4x4 = 16 render chunks
      const dbBaseX = row.chunk_x * SPAWN_DB_CHUNK;
      const dbBaseY = row.chunk_y * SPAWN_DB_CHUNK;
      const positions = (row.positions || []) as Array<{ x: number; y: number }>;

      // Group positions by render chunk
      const renderChunkPositions = new Map<string, Array<{ x: number; y: number }>>();
      for (const pos of positions) {
        const absX = dbBaseX + pos.x;
        const absY = dbBaseY + pos.y;
        const rcx = Math.floor(absX / CHUNK_TILES);
        const rcy = Math.floor(absY / CHUNK_TILES);
        const key = `${rcx},${rcy}`;
        let arr = renderChunkPositions.get(key);
        if (!arr) { arr = []; renderChunkPositions.set(key, arr); }
        arr.push(pos);
      }

      // If no positions, put spawn in center render chunk of DB chunk
      if (positions.length === 0) {
        const centerRcx = Math.floor((dbBaseX + 16) / CHUNK_TILES);
        const centerRcy = Math.floor((dbBaseY + 16) / CHUNK_TILES);
        const key = `${centerRcx},${centerRcy}`;
        let arr = spawnMap.get(key);
        if (!arr) { arr = []; spawnMap.set(key, arr); }
        arr.push({
          creatureName: row.creature_name,
          outfitId: row.outfit_id,
          avgCount: row.avg_count,
          positions: [{ x: 16, y: 16 }],
        });
      } else {
        // Distribute to render chunks
        for (const [key, posArr] of renderChunkPositions) {
          let arr = spawnMap.get(key);
          if (!arr) { arr = []; spawnMap.set(key, arr); }
          arr.push({
            creatureName: row.creature_name,
            outfitId: row.outfit_id,
            avgCount: Math.max(1, Math.round(row.avg_count * posArr.length / positions.length)),
            positions: posArr,
          });
        }
      }
      total++;
    }
    onProgress('spawns', total);
    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  return spawnMap;
}

/** Load terrain chunks (8x8) directly aligned with renderer. */
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

/** Load chunk keys that exist on a given floor (lightweight, no tiles_data). */
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

/** Preload floor data (terrain + spawns + below chunk keys) in parallel. */
async function preloadFloor(
  z: number,
  onProgress: (label: string, count: number) => void,
): Promise<{ tileMap: Map<string, TileData[]>; spawnMap: Map<string, SpawnRenderData[]>; belowChunks: Set<string> }> {
  const [tileMap, spawnMap, belowChunks] = await Promise.all([
    loadChunks(z, onProgress),
    loadSpawns(z, onProgress),
    z <= 14 ? loadBelowChunkKeys(z + 1) : Promise.resolve(new Set<string>()),
  ]);
  return { tileMap, spawnMap, belowChunks };
}

const CamMapPage = () => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.GridLayer | null>(null);
  const rendererRef = useRef<MapTileRenderer | null>(null);
  const floorDataRef = useRef<Map<string, TileData[]>>(new Map());
  const spawnDataRef = useRef<Map<string, SpawnRenderData[]>>(new Map());
  const belowChunksRef = useRef<Set<string>>(new Set());

  const [currentFloor, setCurrentFloor] = useState(DEFAULT_Z);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [floorLoading, setFloorLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);
  const [tileItemIds, setTileItemIds] = useState<number[]>([]);
  const [spawnCount, setSpawnCount] = useState(0);
  const [tileCount, setTileCount] = useState(0);
  const [showSpawns, setShowSpawns] = useState(true);
  const [showLooseItems, setShowLooseItems] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [editingTile, setEditingTile] = useState<{ x: number; y: number; z: number; items: number[] } | null>(null);
  const [brushMode, setBrushMode] = useState<'add' | 'replace' | 'erase'>('add');
  const [pendingCount, setPendingCount] = useState(0);
  const pendingEditsRef = useRef<Map<string, { x: number; y: number; z: number; items: number[] }>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightRectRef = useRef<L.Rectangle | null>(null);
  const editModeRef = useRef(false);
  const brushModeRef = useRef<'add' | 'replace' | 'erase'>('add');
  const selectedItemIdRef = useRef<number | null>(null);

  // Keep refs in sync
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { brushModeRef.current = brushMode; }, [brushMode]);
  useEffect(() => { selectedItemIdRef.current = selectedItemId; }, [selectedItemId]);

  // Load sprite/dat data
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
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
        const dat = new DatLoader();
        dat.load(datBuf);

        rendererRef.current = new MapTileRenderer(spr, dat);
        rendererRef.current.diagnose();
        setAssetsLoading(false);
      } catch (err) {
        console.error('[CamMap] Failed to load data:', err);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Preload entire floor when floor changes
  useEffect(() => {
    if (assetsLoading) return;
    let cancelled = false;

    setFloorLoading(true);
    setLoadingStatus('');

    preloadFloor(currentFloor, (label, count) => {
      if (!cancelled) setLoadingStatus(`${count.toLocaleString()} ${label}`);
    }).then(({ tileMap, spawnMap, belowChunks }) => {
      if (cancelled) return;
      floorDataRef.current = tileMap;
      spawnDataRef.current = spawnMap;
      belowChunksRef.current = belowChunks;
      setTileCount(Array.from(tileMap.values()).reduce((s, a) => s + a.length, 0));
      setSpawnCount(Array.from(spawnMap.values()).reduce((s, a) => s + a.length, 0));
      setFloorLoading(false);
    });

    return () => { cancelled = true; };
  }, [currentFloor, assetsLoading]);

  // Get chunk tiles from memory
  const getChunkTiles = useCallback((chunkX: number, chunkY: number): TileData[] => {
    return floorDataRef.current.get(`${chunkX},${chunkY}`) || [];
  }, []);

  const getChunkSpawns = useCallback((chunkX: number, chunkY: number): SpawnRenderData[] => {
    return spawnDataRef.current.get(`${chunkX},${chunkY}`) || [];
  }, []);

  // Initialize Leaflet map
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

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const tileX = Math.floor(e.latlng.lng);
      const tileY = Math.floor(-e.latlng.lat);
      setMouseCoords({ x: tileX, y: tileY });

      const subCX = Math.floor(tileX / CHUNK_TILES);
      const subCY = Math.floor(tileY / CHUNK_TILES);
      const chunkTiles = floorDataRef.current.get(`${subCX},${subCY}`);
      if (chunkTiles) {
        const tile = chunkTiles.find(t => t.x === tileX && t.y === tileY);
        setTileItemIds(tile ? tile.items : []);
      } else {
        setTileItemIds([]);
      }

      // Highlight rectangle in edit mode
      if (editModeRef.current) {
        const bounds: L.LatLngBoundsExpression = [[-tileY - 1, tileX], [-tileY, tileX + 1]];
        if (highlightRectRef.current) {
          highlightRectRef.current.setBounds(bounds);
        } else {
          highlightRectRef.current = L.rectangle(bounds, {
            color: '#ffcc00',
            weight: 2,
            fillColor: '#ffcc00',
            fillOpacity: 0.15,
            interactive: false,
          }).addTo(map);
        }
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!editModeRef.current) return;
      const tileX = Math.floor(e.latlng.lng);
      const tileY = Math.floor(-e.latlng.lat);

      // Shift+click opens detailed edit panel
      if ((e.originalEvent as MouseEvent).shiftKey) {
        const cx = Math.floor(tileX / CHUNK_TILES);
        const cy = Math.floor(tileY / CHUNK_TILES);
        const chunkTiles = floorDataRef.current.get(`${cx},${cy}`);
        const tile = chunkTiles?.find(t => t.x === tileX && t.y === tileY);
        setEditingTile({
          x: tileX, y: tileY, z: currentFloor,
          items: tile ? [...tile.items] : [],
        });
        return;
      }

      // Paint mode: apply brush directly
      const cx = Math.floor(tileX / CHUNK_TILES);
      const cy = Math.floor(tileY / CHUNK_TILES);
      const key = `${cx},${cy}`;
      const chunkTiles = floorDataRef.current.get(key) || [];
      const existing = chunkTiles.find(t => t.x === tileX && t.y === tileY);
      let newItems: number[];

      const mode = brushModeRef.current;
      const selId = selectedItemIdRef.current;

      if (mode === 'erase') {
        if (!existing || existing.items.length === 0) return;
        newItems = existing.items.slice(0, -1);
      } else if (mode === 'replace') {
        if (!selId) return;
        newItems = [selId];
      } else {
        // add
        if (!selId) return;
        newItems = existing ? [...existing.items, selId] : [selId];
      }

      // Update local data
      if (existing) {
        existing.items = newItems;
      } else {
        chunkTiles.push({ x: tileX, y: tileY, z: currentFloor, items: newItems });
        floorDataRef.current.set(key, chunkTiles);
      }

      // Queue for batch save
      const tileKey = `${tileX},${tileY}`;
      pendingEditsRef.current.set(tileKey, { x: tileX, y: tileY, z: currentFloor, items: newItems });
      setPendingCount(pendingEditsRef.current.size);

      // Redraw
      rendererRef.current?.invalidateFloor(currentFloor);
      tileLayerRef.current?.redraw();

      // Debounced flush
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => flushPendingEdits(), 500);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [assetsLoading]);

  // Build external tile URL for a given leaflet coord
  const getExternalTileUrl = useCallback((z: number, x: number, y: number, floor: number) => {
    const externalZoom = z + 3;
    const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/map-tile-proxy`;
    return `${proxyBase}?zoom=${externalZoom}&floor=${floor}&x=${x}&y=${y}`;
  }, []);

  // Create/update tile layer when floor data is ready
  useEffect(() => {
    const map = mapRef.current;
    const renderer = rendererRef.current;
    if (!map || !renderer || floorLoading) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    renderer.invalidateFloor(currentFloor);

    const floor = currentFloor;

    const CustomTileLayer = L.GridLayer.extend({
      createTile(coords: L.Coords, done: L.DoneCallback) {
        const tile = document.createElement('canvas');
        tile.width = 256;
        tile.height = 256;
        const ctx = tile.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        // Load external base tile first, then overlay cam data
        const img = new Image();
        img.crossOrigin = '';
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 256, 256);
          drawCamData(ctx, coords);
          (done as any)(null, tile);
        };
        img.onerror = () => {
          // No base tile — just draw cam data (silently ignore 404s)
          drawCamData(ctx, coords);
          (done as any)(null, tile);
        };
        // Suppress console 404 errors: only load if we expect the tile to exist
        const url = getExternalTileUrl(coords.z, coords.x, coords.y, floor);
        img.src = url;

        /** Collect border tiles from adjacent chunks (up to 2 tiles into neighbors). */
        function collectBorderTiles(cx: number, cy: number): TileData[] {
          const border: TileData[] = [];
          const baseX = cx * CHUNK_TILES;
          const baseY = cy * CHUNK_TILES;
          // Check all 8 neighbors + the chunk itself isn't needed (already passed as tiles)
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ncx = cx + dx;
              const ncy = cy + dy;
              const neighborTiles = getChunkTiles(ncx, ncy);
              for (const t of neighborTiles) {
                // Only include tiles within 2 positions of our chunk boundary
                const relX = t.x - baseX;
                const relY = t.y - baseY;
                if (relX >= -2 && relX < CHUNK_TILES + 2 && relY >= -2 && relY < CHUNK_TILES + 2) {
                  border.push(t);
                }
              }
            }
          }
          return border;
        }

        function drawCamData(c: CanvasRenderingContext2D, co: L.Coords) {
          const chunksPerTile = Math.pow(2, 5 - co.z);
          const baseChunkX = co.x * chunksPerTile;
          const baseChunkY = co.y * chunksPerTile;

          const below = belowChunksRef.current;
          const renderOpts: any = {};
          if (!showLooseItems) renderOpts.hideLooseItems = true;
          if (below.size > 0) renderOpts.belowChunks = below;
          const opts = Object.keys(renderOpts).length > 0 ? renderOpts : undefined;
          if (chunksPerTile === 1) {
            const tiles = getChunkTiles(baseChunkX, baseChunkY);
            const spawns = showSpawns ? getChunkSpawns(baseChunkX, baseChunkY) : [];
            const border = collectBorderTiles(baseChunkX, baseChunkY);
            if (tiles.length > 0 || spawns.length > 0) {
              const rendered = renderer.renderChunk(baseChunkX, baseChunkY, floor, tiles, undefined, spawns, opts, border);
              if (rendered) c.drawImage(rendered, 0, 0, 256, 256);
            }
          } else {
            const chunkPx = 256 / chunksPerTile;
            for (let cy = 0; cy < chunksPerTile; cy++) {
              for (let cx = 0; cx < chunksPerTile; cx++) {
                const tcx = baseChunkX + cx;
                const tcy = baseChunkY + cy;
                const tiles = getChunkTiles(tcx, tcy);
                const spawns = showSpawns ? getChunkSpawns(tcx, tcy) : [];
                const border = collectBorderTiles(tcx, tcy);
                if (tiles.length > 0 || spawns.length > 0) {
                  const rendered = renderer.renderChunk(tcx, tcy, floor, tiles, undefined, spawns, opts, border);
                  if (rendered) c.drawImage(rendered, cx * chunkPx, cy * chunkPx, chunkPx, chunkPx);
                }
              }
            }
          }
        }

        return tile;
      },
    });
    const layer = new (CustomTileLayer as any)({
      tileSize: 256,
      minZoom: 0,
      maxZoom: 5,
      noWrap: true,
    }) as L.GridLayer;

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [currentFloor, floorLoading, getChunkTiles, getChunkSpawns, getExternalTileUrl, showSpawns, showLooseItems]);

  const floorDisplay = 7 - currentFloor;
  const isLoading = assetsLoading || floorLoading;

  // Flush pending edits to database
  const flushPendingEdits = useCallback(async () => {
    const edits = Array.from(pendingEditsRef.current.values());
    if (edits.length === 0) return;
    pendingEditsRef.current.clear();
    setPendingCount(0);

    try {
      // Batch upsert tiles
      for (const edit of edits) {
        await supabase
          .from('cam_map_tiles')
          .upsert({
            x: edit.x, y: edit.y, z: edit.z,
            items: edit.items as any,
            seen_count: 999,
          } as any);

        // Update chunk
        const cx = Math.floor(edit.x / CHUNK_TILES);
        const cy = Math.floor(edit.y / CHUNK_TILES);
        const relX = edit.x - cx * CHUNK_TILES;
        const relY = edit.y - cy * CHUNK_TILES;
        const relKey = `${relX},${relY}`;

        const { data: chunkData } = await supabase
          .from('cam_map_chunks')
          .select('tiles_data')
          .eq('chunk_x', cx)
          .eq('chunk_y', cy)
          .eq('z', edit.z)
          .maybeSingle();

        const tilesData = (chunkData?.tiles_data || {}) as Record<string, number[]>;
        tilesData[relKey] = edit.items;

        await supabase
          .from('cam_map_chunks')
          .upsert({
            chunk_x: cx, chunk_y: cy, z: edit.z,
            tiles_data: tilesData as any,
          } as any);
      }
    } catch (err: any) {
      console.error('[CamMap] Flush error:', err);
    }
  }, []);

  // Remove highlight when leaving edit mode
  useEffect(() => {
    if (!editMode && highlightRectRef.current) {
      highlightRectRef.current.remove();
      highlightRectRef.current = null;
    }
  }, [editMode]);

  // Cursor override for edit mode
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    const leafletEl = container.querySelector('.leaflet-container') as HTMLElement;
    if (leafletEl) {
      leafletEl.style.cursor = editMode ? 'crosshair' : '';
    }
  }, [editMode]);

  // Handle tile saved from editor
  const handleTileSaved = useCallback((x: number, y: number, z: number, newItems: number[]) => {
    const cx = Math.floor(x / CHUNK_TILES);
    const cy = Math.floor(y / CHUNK_TILES);
    const key = `${cx},${cy}`;
    const chunkTiles = floorDataRef.current.get(key) || [];
    const existing = chunkTiles.find(t => t.x === x && t.y === y);
    if (existing) {
      existing.items = newItems;
    } else {
      chunkTiles.push({ x, y, z, items: newItems });
      floorDataRef.current.set(key, chunkTiles);
    }
    rendererRef.current?.invalidateFloor(z);
    if (tileLayerRef.current) {
      tileLayerRef.current.redraw();
    }
    setEditingTile(null);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gold hover:text-gold/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-gold" />
            <h1 className="font-heading text-lg text-gold">Cam Map</h1>
          </div>
          <Link to="/f9a2c8d4e7b1/extract" className="text-xs text-muted-foreground hover:text-gold transition-colors ml-4">
            📦 Batch Extract
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative">
          <div
            ref={mapContainerRef}
            className="absolute inset-0"
            style={{ background: '#1a2420', visibility: assetsLoading ? 'hidden' : 'visible' }}
          />

          {assetsLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
                <p className="text-sm text-muted-foreground">Carregando sprites...</p>
              </div>
            </div>
          )}

          {/* Floor loading overlay */}
          {!assetsLoading && floorLoading && (
            <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 w-64">
                <Loader2 className="w-6 h-6 text-gold animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Carregando andar... {loadingStatus}
                </p>
                <Progress value={undefined} className="w-full h-2" />
              </div>
            </div>
          )}

          {/* Floor controls overlay */}
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

              <div className="border-t border-border/50 mt-1 pt-1 flex flex-col gap-1">
                <button
                  onClick={() => setShowSpawns(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-1 py-0.5 rounded transition-colors ${showSpawns ? 'text-gold' : 'text-muted-foreground'}`}
                  title="Mostrar/ocultar spawns de criaturas"
                >
                  <Bug className="w-3.5 h-3.5" />
                  Spawns
                </button>
                <button
                  onClick={() => setShowLooseItems(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-1 py-0.5 rounded transition-colors ${showLooseItems ? 'text-gold' : 'text-muted-foreground'}`}
                  title="Mostrar/ocultar itens soltos e corpos"
                >
                  <Package className="w-3.5 h-3.5" />
                  Itens
                </button>
                <button
                  onClick={() => { setEditMode(v => !v); setEditingTile(null); }}
                  className={`flex items-center gap-1.5 text-xs px-1 py-0.5 rounded transition-colors ${editMode ? 'text-gold' : 'text-muted-foreground'}`}
                  title="Ativar/desativar modo de edição"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>

                {/* Brush mode selector */}
                {editMode && (
                  <div className="border-t border-border/50 mt-1 pt-1 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Pincel</span>
                    <button
                      onClick={() => setBrushMode('add')}
                      className={`flex items-center gap-1.5 text-xs px-1 py-0.5 rounded transition-colors ${brushMode === 'add' ? 'text-gold bg-muted/50' : 'text-muted-foreground'}`}
                      title="Adicionar sprite ao tile"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                    <button
                      onClick={() => setBrushMode('replace')}
                      className={`flex items-center gap-1.5 text-xs px-1 py-0.5 rounded transition-colors ${brushMode === 'replace' ? 'text-gold bg-muted/50' : 'text-muted-foreground'}`}
                      title="Substituir todos os itens do tile"
                    >
                      <Replace className="w-3.5 h-3.5" />
                      Replace
                    </button>
                    <button
                      onClick={() => setBrushMode('erase')}
                      className={`flex items-center gap-1.5 text-xs px-1 py-0.5 rounded transition-colors ${brushMode === 'erase' ? 'text-gold bg-muted/50' : 'text-muted-foreground'}`}
                      title="Apagar último item do tile"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      Erase
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edit mode sidebar (absolute overlay) */}
          {editMode && !assetsLoading && rendererRef.current && (
            <SpriteSidebar
              renderer={rendererRef.current}
              selectedItemId={selectedItemId}
              onSelect={setSelectedItemId}
              onClose={() => setEditMode(false)}
            />
          )}

          {/* Tile edit panel (only in edit mode) */}
          {editMode && editingTile && rendererRef.current && (
            <TileEditPanel
              tile={editingTile}
              renderer={rendererRef.current}
              selectedItemId={selectedItemId}
              onClose={() => setEditingTile(null)}
              onSaved={handleTileSaved}
            />
          )}

          {/* Coordinates + Item IDs + Legend overlay */}
          {!isLoading && mouseCoords && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-card/90 border border-border/50 rounded-sm px-3 py-1.5 max-w-sm">
              <span className="text-xs font-mono text-muted-foreground">
                X: {mouseCoords.x} | Y: {mouseCoords.y} | Z: {currentFloor}
              </span>
              {tileItemIds.length > 0 && (
                <div className="text-xs font-mono text-muted-foreground mt-0.5">
                  IDs: {tileItemIds.join(', ')}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1 border-t border-border/30 pt-1">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 border-2 rounded-sm" style={{ borderColor: '#00ff88', background: 'rgba(0,255,136,0.15)' }} />
                  <span className="text-xs text-muted-foreground">Rope</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 border-2 rounded-sm" style={{ borderColor: '#ffcc00', background: 'rgba(255,204,0,0.15)' }} />
                  <span className="text-xs text-muted-foreground">Shovel</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 border-2 rounded-sm" style={{ borderColor: '#ff4444', background: 'rgba(255,68,68,0.2)' }} />
                  <span className="text-xs text-muted-foreground">Inexplorado</span>
                </div>
              </div>
            </div>
          )}

          {/* Tile/creature count overlay */}
          {!isLoading && (
            <div className="absolute bottom-4 right-4 z-[1000] bg-card/90 border border-border/50 rounded-sm px-3 py-1.5">
              <span className="text-xs text-muted-foreground">
                {tileCount.toLocaleString()} tiles | {spawnCount.toLocaleString()} spawns
              </span>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 mt-1 border-t border-border/30 pt-1">
                  <Save className="w-3 h-3 text-gold animate-pulse" />
                  <span className="text-xs text-gold">{pendingCount} tiles não salvos</span>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default CamMapPage;
