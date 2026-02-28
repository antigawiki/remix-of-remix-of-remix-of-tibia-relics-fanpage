import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon, ChevronUp, ChevronDown, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { MapTileRenderer, type TileData } from '@/lib/tibiaRelic/mapTileRenderer';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Tibia map center (roughly Thais area)
const DEFAULT_CENTER_X = 32369;
const DEFAULT_CENTER_Y = 32241;
const DEFAULT_Z = 7;
const CHUNK_TILES = 8;

// Batch fetching: accumulate chunk requests and resolve them in one query
function createBatchFetcher() {
  const cache = new Map<string, TileData[]>();
  let pendingChunks: Array<{
    chunkX: number;
    chunkY: number;
    z: number;
    resolve: (tiles: TileData[]) => void;
  }> = [];
  let batchTimer: ReturnType<typeof setTimeout> | null = null;

  async function flushBatch() {
    batchTimer = null;
    const batch = pendingChunks;
    pendingChunks = [];
    if (batch.length === 0) return;

    const z = batch[0].z;

    // Compute bounding box of all requested chunks
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const req of batch) {
      const bx = req.chunkX * CHUNK_TILES;
      const by = req.chunkY * CHUNK_TILES;
      if (bx < minX) minX = bx;
      if (bx + CHUNK_TILES > maxX) maxX = bx + CHUNK_TILES;
      if (by < minY) minY = by;
      if (by + CHUNK_TILES > maxY) maxY = by + CHUNK_TILES;
    }

    // Single query for the entire visible area
    const { data, error } = await supabase
      .from('cam_map_tiles')
      .select('x, y, z, items')
      .eq('z', z)
      .gte('x', minX)
      .lt('x', maxX)
      .gte('y', minY)
      .lt('y', maxY);

    // Group results by chunk
    const chunkMap = new Map<string, TileData[]>();
    if (data && !error) {
      for (const row of data as any[]) {
        const cx = Math.floor(row.x / CHUNK_TILES);
        const cy = Math.floor(row.y / CHUNK_TILES);
        const key = `${cx},${cy},${z}`;
        let arr = chunkMap.get(key);
        if (!arr) { arr = []; chunkMap.set(key, arr); }
        arr.push({ x: row.x, y: row.y, z: row.z, items: row.items as number[] });
      }
    }

    // Resolve all pending promises & populate cache
    for (const req of batch) {
      const key = `${req.chunkX},${req.chunkY},${req.z}`;
      const tiles = chunkMap.get(key) || [];
      cache.set(key, tiles);
      req.resolve(tiles);
    }
  }

  function fetchChunk(chunkX: number, chunkY: number, z: number): Promise<TileData[]> {
    const key = `${chunkX},${chunkY},${z}`;
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve) => {
      pendingChunks.push({ chunkX, chunkY, z, resolve });
      if (!batchTimer) {
        batchTimer = setTimeout(flushBatch, 10);
      }
    });
  }

  function clearCache() {
    cache.clear();
  }

  return { fetchChunk, clearCache };
}

const CamMapPage = () => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.GridLayer | null>(null);
  const rendererRef = useRef<MapTileRenderer | null>(null);
  const batchFetcherRef = useRef(createBatchFetcher());

  const [currentFloor, setCurrentFloor] = useState(DEFAULT_Z);
  const [loading, setLoading] = useState(true);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);
  const [tileCount, setTileCount] = useState(0);

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
        setLoading(false);
      } catch (err) {
        console.error('[CamMap] Failed to load data:', err);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Fetch tile count
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('cam_map_tiles')
        .select('*', { count: 'exact', head: true })
        .eq('z', currentFloor);
      if (count !== null) setTileCount(count);
    };
    fetchCount();
  }, [currentFloor]);

  const fetchChunkTiles = useCallback((chunkX: number, chunkY: number, z: number) => {
    return batchFetcherRef.current.fetchChunk(chunkX, chunkY, z);
  }, []);

  // Initialize Leaflet map
  // Coordinate system: use raw Tibia coords as CRS units.
  // At zoom 5 (max), 1 CRS unit = 32 pixels, so 1 tile = 32px (native).
  // A 256px leaflet tile = 8 tibia tiles = 1 chunk.
  // tileCoord.x = floor(lng * 2^zoom / 256)
  // At zoom 5: tileCoord = floor(tibiaX * 32 / 256) = floor(tibiaX / 8) = chunkX ✓
  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: 0,
      maxZoom: 5,
      zoomControl: true,
      attributionControl: false,
    });

    // Use raw Tibia coordinates: lng = x, lat = -y
    map.setView([-DEFAULT_CENTER_Y, DEFAULT_CENTER_X], 3);
    mapRef.current = map;

    // Track mouse position in Tibia coords
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const tileX = Math.floor(e.latlng.lng);
      const tileY = Math.floor(-e.latlng.lat);
      setMouseCoords({ x: tileX, y: tileY });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [loading]);

  // Create/update tile layer when floor changes
  useEffect(() => {
    const map = mapRef.current;
    const renderer = rendererRef.current;
    if (!map || !renderer) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    batchFetcherRef.current.clearCache();

    // At zoom z, each leaflet tile covers 2^(5-z) chunks.
    // chunkX = tileCoord.x * 2^(5-z)  (at zoom 5, chunkX = tileCoord.x)
    // chunkY = tileCoord.y * 2^(5-z)  (tileCoord.y maps to -lat, i.e. positive tibia Y)
    const CustomTileLayer = L.GridLayer.extend({
      createTile(coords: L.Coords, done: L.DoneCallback) {
        const tile = document.createElement('canvas');
        tile.width = 256;
        tile.height = 256;

        const chunksPerTile = Math.pow(2, 5 - coords.z);
        const baseChunkX = coords.x * chunksPerTile;
        const baseChunkY = coords.y * chunksPerTile;

        if (chunksPerTile === 1) {
          // At zoom 5: 1 leaflet tile = 1 chunk
          fetchChunkTiles(baseChunkX, baseChunkY, currentFloor).then((tiles: TileData[]) => {
            if (tiles.length > 0) {
              const rendered = renderer.renderChunk(baseChunkX, baseChunkY, currentFloor, tiles);
              if (rendered) {
                const ctx = tile.getContext('2d')!;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(rendered, 0, 0, 256, 256);
              }
            }
            (done as any)(null, tile);
          }).catch(() => (done as any)(null, tile));
        } else {
          // Lower zoom: render multiple chunks scaled down into one tile
          const chunkPx = 256 / chunksPerTile;
          const ctx = tile.getContext('2d')!;
          ctx.imageSmoothingEnabled = false;

          const promises: Promise<void>[] = [];
          for (let cy = 0; cy < chunksPerTile; cy++) {
            for (let cx = 0; cx < chunksPerTile; cx++) {
              const tcx = baseChunkX + cx;
              const tcy = baseChunkY + cy;
              promises.push(
                fetchChunkTiles(tcx, tcy, currentFloor).then(tiles => {
                  if (tiles.length > 0) {
                    const rendered = renderer.renderChunk(tcx, tcy, currentFloor, tiles);
                    if (rendered) {
                      ctx.drawImage(rendered, cx * chunkPx, cy * chunkPx, chunkPx, chunkPx);
                    }
                  }
                })
              );
            }
          }

          Promise.all(promises).then(() => (done as any)(null, tile)).catch(() => (done as any)(null, tile));
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
  }, [currentFloor, loading, fetchChunkTiles]);

  const floorDisplay = 7 - currentFloor;

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
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <p className="text-sm text-muted-foreground">Carregando sprites...</p>
            </div>
          </div>
        ) : (
          <div ref={mapContainerRef} className="absolute inset-0" style={{ background: '#1a2420' }} />
        )}

        {/* Floor controls overlay */}
        {!loading && (
          <div className="absolute top-4 right-4 z-[1000] flex flex-col items-center gap-1 bg-card/90 border border-border/50 rounded-sm p-2">
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

        {/* Coordinates overlay */}
        {!loading && mouseCoords && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-card/90 border border-border/50 rounded-sm px-3 py-1.5">
            <span className="text-xs font-mono text-muted-foreground">
              X: {mouseCoords.x} | Y: {mouseCoords.y} | Z: {currentFloor}
            </span>
          </div>
        )}

        {/* Tile count overlay */}
        {!loading && (
          <div className="absolute bottom-4 right-4 z-[1000] bg-card/90 border border-border/50 rounded-sm px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              {tileCount.toLocaleString()} tiles mapeados neste andar
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CamMapPage;
