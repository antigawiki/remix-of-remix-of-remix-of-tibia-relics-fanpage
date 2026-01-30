import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Tibia map coordinate system
// Origin offset - the top-left corner of the map in Tibia world coordinates
const MAP_ORIGIN_X = 31744;
const MAP_ORIGIN_Y = 30976;

// Image dimensions (from the uploaded floor images)
const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 2048;

interface MapViewerProps {
  x: number;
  y: number;
  z: number;
  zoom?: number;
  className?: string;
}

const MapViewer = ({ x, y, z, zoom = 1, className = '' }: MapViewerProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const imageOverlay = useRef<L.ImageOverlay | null>(null);
  const [currentFloor, setCurrentFloor] = useState(z);

  // Get floor image URL
  const getFloorImageUrl = (floor: number) => {
    const floorNum = String(floor).padStart(2, '0');
    return `/map/floor-${floorNum}-map.png`;
  };

  // Convert Tibia world coordinates to image pixel coordinates
  const worldToPixel = (worldX: number, worldY: number): [number, number] => {
    const pixelX = worldX - MAP_ORIGIN_X;
    const pixelY = worldY - MAP_ORIGIN_Y;
    return [pixelX, pixelY];
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || leafletMap.current) return;

    // Create map with CRS.Simple for image overlay
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 4,
      zoomControl: true,
      attributionControl: false,
    });

    leafletMap.current = map;

    // Define bounds: [[y_min, x_min], [y_max, x_max]]
    // Since Leaflet CRS.Simple has Y increasing upward, we use negative Y
    const bounds: L.LatLngBoundsExpression = [
      [-IMAGE_HEIGHT, 0],
      [0, IMAGE_WIDTH]
    ];

    // Add initial floor image
    const overlay = L.imageOverlay(getFloorImageUrl(currentFloor), bounds);
    overlay.addTo(map);
    imageOverlay.current = overlay;

    // Set map bounds for panning
    map.setMaxBounds([
      [-IMAGE_HEIGHT - 200, -200],
      [200, IMAGE_WIDTH + 200]
    ]);

    // Convert target coordinates to pixel position
    const [pixelX, pixelY] = worldToPixel(x, y);
    
    // Marker position: (-pixelY, pixelX) because Leaflet Y is inverted
    const markerPos: L.LatLngExpression = [-pixelY, pixelX];

    console.log(`Map: World (${x}, ${y}, ${z}) -> Pixel (${pixelX}, ${pixelY}) -> Leaflet`, markerPos);

    // Add marker at target location
    const targetMarker = L.circleMarker(markerPos, {
      radius: 12,
      color: '#8B0000',
      fillColor: '#FF0000',
      fillOpacity: 0.9,
      weight: 3,
    });
    targetMarker.addTo(map);

    // Add tooltip
    targetMarker.bindTooltip(`Posição: ${x}, ${y}`, {
      permanent: false,
      direction: 'top'
    });

    // Center on target
    map.setView(markerPos, zoom);

    // Fit bounds to show area around marker
    const viewBounds = L.latLngBounds(
      [-pixelY - 150, pixelX - 200],
      [-pixelY + 150, pixelX + 200]
    );
    map.fitBounds(viewBounds);

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, [x, y, z]);

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
        ref={mapContainerRef} 
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
