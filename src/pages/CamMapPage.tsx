import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon, ChevronUp, ChevronDown, Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SprLoader } from '@/lib/tibiaRelic/sprLoader';
import { DatLoader } from '@/lib/tibiaRelic/datLoader';
import { MapTileRenderer, type TileData, type CreatureData } from '@/lib/tibiaRelic/mapTileRenderer';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER_X = 32369;
const DEFAULT_CENTER_Y = 32241;
const DEFAULT_Z = 7;
const CHUNK_TILES = 8;
const PAGE_SIZE = 1000;

/** Preload all tiles for a floor using paginated queries, returning a Map indexed by chunk key. */
async function preloadFloor(
  z: number,
  onProgress: (loaded: number) => void,
): Promise<{ chunkMap: Map<string, TileData[]>; creatureMap: Map<string, CreatureData[]> }> {
  const chunkMap = new Map<string, TileData[]>();
  const creatureMap = new Map<string, CreatureData[]>();

  // Load tiles
  let offset = 0;
  let total = 0;
  while (true) {
    const { data, error } = await supabase
      .from('cam_map_tiles')
      .select('x, y, z, items')
      .eq('z', z)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data as any[]) {
      const cx = Math.floor(row.x / CHUNK_TILES);
      const cy = Math.floor(row.y / CHUNK_TILES);
      const key = `${cx},${cy}`;
      let arr = chunkMap.get(key);
      if (!arr) { arr = []; chunkMap.set(key, arr); }
      arr.push({ x: row.x, y: row.y, z: row.z, items: row.items as number[] });
    }

    total += data.length;
    onProgress(total);
    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  // Load creatures
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('cam_map_creatures' as any)
      .select('x, y, z, name, outfit_id, direction')
      .eq('z', z)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data as any[]) {
      const cx = Math.floor(row.x / CHUNK_TILES);
      const cy = Math.floor(row.y / CHUNK_TILES);
      const key = `${cx},${cy}`;
      let arr = creatureMap.get(key);
      if (!arr) { arr = []; creatureMap.set(key, arr); }
      arr.push({ x: row.x, y: row.y, z: row.z, name: row.name, outfit_id: row.outfit_id, direction: row.direction });
    }

    offset += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  return { chunkMap, creatureMap };
}

const CamMapPage = () => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.GridLayer | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const rendererRef = useRef<MapTileRenderer | null>(null);
  const floorDataRef = useRef<Map<string, TileData[]>>(new Map());
  const creatureDataRef = useRef<Map<string, CreatureData[]>>(new Map());
  const [showBaseMap, setShowBaseMap] = useState(true);

  const [currentFloor, setCurrentFloor] = useState(DEFAULT_Z);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [floorLoading, setFloorLoading] = useState(true);
  const [loadedTiles, setLoadedTiles] = useState(0);
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
    setLoadedTiles(0);

    preloadFloor(currentFloor, (count) => {
      if (!cancelled) setLoadedTiles(count);
    }).then(({ chunkMap, creatureMap }) => {
      if (cancelled) return;
      floorDataRef.current = chunkMap;
      creatureDataRef.current = creatureMap;
      setTileCount(Array.from(chunkMap.values()).reduce((s, a) => s + a.length, 0));
      setFloorLoading(false);
    });

    return () => { cancelled = true; };
  }, [currentFloor, assetsLoading]);

  // Get chunk tiles from memory (instant)
  const getChunkTiles = useCallback((chunkX: number, chunkY: number): TileData[] => {
    return floorDataRef.current.get(`${chunkX},${chunkY}`) || [];
  }, []);

  const getChunkCreatures = useCallback((chunkX: number, chunkY: number): CreatureData[] => {
    return creatureDataRef.current.get(`${chunkX},${chunkY}`) || [];
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

    // External base map layer (direct access — img tags bypass CORS)
    // Zoom mapping: external_zoom = leaflet_zoom + 3
    // At leaflet zoom 4 → external zoom 7 (max native), leaflet zoom 5 is upscaled
    const ExternalTileLayer = L.TileLayer.extend({
      getTileUrl(coords: L.Coords) {
        const externalZoom = coords.z + 3;
        const floor = (this as any).options.floor ?? 7;
        return `https://st54085.ispot.cc/mapper/tibiarelic/${externalZoom}/${floor}/${coords.x}_${coords.y}.png`;
      },
    });

    const baseLayer = new (ExternalTileLayer as any)({
      tileSize: 256,
      minZoom: 0,
      maxZoom: 5,
      maxNativeZoom: 4, // external zoom 7 is the max available
      noWrap: true,
      floor: DEFAULT_Z,
      errorTileUrl: '',
    }) as L.TileLayer;

    baseLayer.addTo(map);
    baseLayerRef.current = baseLayer;

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const tileX = Math.floor(e.latlng.lng);
      const tileY = Math.floor(-e.latlng.lat);
      setMouseCoords({ x: tileX, y: tileY });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      baseLayerRef.current = null;
    };
  }, [assetsLoading]);

  // Update base layer floor when floor changes
  useEffect(() => {
    const baseLayer = baseLayerRef.current;
    if (!baseLayer) return;
    (baseLayer as any).options.floor = currentFloor;
    baseLayer.redraw();
  }, [currentFloor]);

  // Toggle base map visibility
  useEffect(() => {
    const baseLayer = baseLayerRef.current;
    const map = mapRef.current;
    if (!baseLayer || !map) return;
    if (showBaseMap) {
      if (!map.hasLayer(baseLayer)) baseLayer.addTo(map);
    } else {
      if (map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
    }
  }, [showBaseMap]);

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

    const CustomTileLayer = L.GridLayer.extend({
      createTile(coords: L.Coords, done: L.DoneCallback) {
        const tile = document.createElement('canvas');
        tile.width = 256;
        tile.height = 256;

        const chunksPerTile = Math.pow(2, 5 - coords.z);
        const baseChunkX = coords.x * chunksPerTile;
        const baseChunkY = coords.y * chunksPerTile;
        const ctx = tile.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        if (chunksPerTile === 1) {
          const tiles = getChunkTiles(baseChunkX, baseChunkY);
          const creatures = getChunkCreatures(baseChunkX, baseChunkY);
          if (tiles.length > 0 || creatures.length > 0) {
            const rendered = renderer.renderChunk(baseChunkX, baseChunkY, currentFloor, tiles, creatures);
            if (rendered) ctx.drawImage(rendered, 0, 0, 256, 256);
          }
        } else {
          const chunkPx = 256 / chunksPerTile;
          for (let cy = 0; cy < chunksPerTile; cy++) {
            for (let cx = 0; cx < chunksPerTile; cx++) {
              const tcx = baseChunkX + cx;
              const tcy = baseChunkY + cy;
              const tiles = getChunkTiles(tcx, tcy);
              const creatures = getChunkCreatures(tcx, tcy);
              if (tiles.length > 0 || creatures.length > 0) {
                const rendered = renderer.renderChunk(tcx, tcy, currentFloor, tiles, creatures);
                if (rendered) ctx.drawImage(rendered, cx * chunkPx, cy * chunkPx, chunkPx, chunkPx);
              }
            }
          }
        }

        // Synchronous — everything is in memory
        setTimeout(() => (done as any)(null, tile), 0);
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
  }, [currentFloor, floorLoading, getChunkTiles, getChunkCreatures]);

  const floorDisplay = 7 - currentFloor;
  const isLoading = assetsLoading || floorLoading;

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

        {/* Floor loading overlay */}
        {!assetsLoading && floorLoading && (
          <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 w-64">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
              <p className="text-sm text-muted-foreground">
                Carregando andar... {loadedTiles.toLocaleString()} tiles
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

            {/* Base map toggle */}
            <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-border/50">
              <Switch
                id="base-map"
                checked={showBaseMap}
                onCheckedChange={setShowBaseMap}
                className="scale-75"
              />
              <Label htmlFor="base-map" className="text-[10px] text-muted-foreground cursor-pointer">
                <Layers className="w-3 h-3 inline mr-0.5" />
                Base
              </Label>
            </div>
          </div>
        )}

        {/* Coordinates overlay */}
        {!isLoading && mouseCoords && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-card/90 border border-border/50 rounded-sm px-3 py-1.5">
            <span className="text-xs font-mono text-muted-foreground">
              X: {mouseCoords.x} | Y: {mouseCoords.y} | Z: {currentFloor}
            </span>
          </div>
        )}

        {/* Tile count overlay */}
        {!isLoading && (
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
