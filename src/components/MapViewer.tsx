import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Map configuration based on Tibia coordinates
const MAP_CONFIG = {
  // Image dimensions (each floor image is 1280x960)
  imageWidth: 1280,
  imageHeight: 960,
  // Tibia world bounds (approximate)
  worldMinX: 31744,
  worldMinY: 30976,
  worldMaxX: 33792,
  worldMaxY: 32896,
  // Zoom levels
  minZoom: 0,
  maxZoom: 4,
  defaultZoom: 2,
};

// Calculate the scale factor between world coordinates and image pixels
const worldWidth = MAP_CONFIG.worldMaxX - MAP_CONFIG.worldMinX;
const worldHeight = MAP_CONFIG.worldMaxY - MAP_CONFIG.worldMinY;
const scaleX = MAP_CONFIG.imageWidth / worldWidth;
const scaleY = MAP_CONFIG.imageHeight / worldHeight;

// Convert Tibia world coordinates to image pixel coordinates
function worldToPixel(x: number, y: number): [number, number] {
  const pixelX = (x - MAP_CONFIG.worldMinX) * scaleX;
  const pixelY = (y - MAP_CONFIG.worldMinY) * scaleY;
  return [pixelX, pixelY];
}

interface MapViewerProps {
  x: number;
  y: number;
  z: number;
  zoom?: number;
  className?: string;
}

const MapViewer = ({ x, y, z, zoom = MAP_CONFIG.defaultZoom, className = '' }: MapViewerProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const imageOverlay = useRef<L.ImageOverlay | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const [currentFloor, setCurrentFloor] = useState(z);

  // Get floor image URL
  const getFloorImageUrl = (floor: number) => {
    const floorNum = String(floor).padStart(2, '0');
    return `/map/floor-${floorNum}-map.png`;
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Create map with CRS.Simple for image overlay
    const map = L.map(mapRef.current, {
      crs: L.CRS.Simple,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      zoomControl: true,
      attributionControl: false,
    });

    leafletMap.current = map;

    // Calculate bounds for the image overlay
    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [MAP_CONFIG.imageHeight, MAP_CONFIG.imageWidth]
    ];

    // Add initial floor image
    const overlay = L.imageOverlay(getFloorImageUrl(currentFloor), bounds);
    overlay.addTo(map);
    imageOverlay.current = overlay;

    // Set map bounds
    map.setMaxBounds(bounds);
    map.fitBounds(bounds);

    // Convert target coordinates to pixel position
    const [pixelX, pixelY] = worldToPixel(x, y);

    // Add marker at target location
    const targetMarker = L.circleMarker([MAP_CONFIG.imageHeight - pixelY, pixelX], {
      radius: 10,
      color: '#8B0000',
      fillColor: '#DC143C',
      fillOpacity: 0.8,
      weight: 3,
    });
    targetMarker.addTo(map);
    marker.current = targetMarker;

    // Center on target with provided zoom
    map.setView([MAP_CONFIG.imageHeight - pixelY, pixelX], zoom);

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Update floor when changed
  useEffect(() => {
    if (!leafletMap.current || !imageOverlay.current) return;
    
    imageOverlay.current.setUrl(getFloorImageUrl(currentFloor));
  }, [currentFloor]);

  // Handle floor change
  const changeFloor = (delta: number) => {
    const newFloor = Math.max(0, Math.min(15, currentFloor + delta));
    setCurrentFloor(newFloor);
  };

  // Get floor label
  const getFloorLabel = (floor: number) => {
    if (floor === 7) return 'Superfície';
    if (floor < 7) return `+${7 - floor}`;
    return `-${floor - 7}`;
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-sm"
        style={{ minHeight: '400px', background: '#000' }}
      />
      
      {/* Floor controls */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col items-center gap-1 bg-parchment/95 rounded-sm border border-border p-1 shadow-md">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => changeFloor(-1)}
          disabled={currentFloor === 0}
          title="Subir andar"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        
        <div className="text-xs font-semibold text-text-dark px-2 py-1 min-w-[40px] text-center">
          {getFloorLabel(currentFloor)}
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => changeFloor(1)}
          disabled={currentFloor === 15}
          title="Descer andar"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Coordinates display */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-parchment/95 rounded-sm border border-border px-2 py-1 shadow-md">
        <span className="text-xs text-text-dark">
          <strong>Posição:</strong> {x}, {y}, {z}
        </span>
      </div>
    </div>
  );
};

export default MapViewer;
