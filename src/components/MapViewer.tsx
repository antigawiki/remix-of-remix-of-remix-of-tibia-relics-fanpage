import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Tibia map coordinate system
// The floor images represent a specific area of the Tibia world
// Based on analysis of the reference map at maprelic.netlify.app
// The images are 2048x2048 pixels and represent world coordinates
const MAP_ORIGIN_X = 31744;
const MAP_ORIGIN_Y = 30976;

// Image dimensions
const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 2048;

interface MapViewerProps {
  x: number;
  y: number;
  z: number;
  zoom?: number;
  className?: string;
}

const MapViewer = ({ x, y, z, zoom = 2, className = '' }: MapViewerProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const imageOverlay = useRef<L.ImageOverlay | null>(null);
  const [currentFloor, setCurrentFloor] = useState(z);

  // Get floor image URL
  const getFloorImageUrl = (floor: number) => {
    const floorNum = String(floor).padStart(2, '0');
    return `/map/floor-${floorNum}-map.png`;
  };

  // Convert Tibia world coordinates to Leaflet coordinates
  // The floor images have 1:1 pixel to coordinate mapping
  // Leaflet uses [lat, lng] format where lat is Y and lng is X
  const worldToLeaflet = (worldX: number, worldY: number): L.LatLngExpression => {
    // Direct mapping - the images start at MAP_ORIGIN coordinates
    const pixelX = worldX - MAP_ORIGIN_X;
    const pixelY = worldY - MAP_ORIGIN_Y;
    
    // Leaflet expects [y, x] format
    // In our image, Y increases downward, which matches Leaflet's default behavior
    return [pixelY, pixelX];
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

    // Define bounds for the image: [[y_min, x_min], [y_max, x_max]]
    // In Leaflet CRS.Simple, the origin (0,0) is at bottom-left by default
    // But we want top-left origin to match image coordinates
    const bounds: L.LatLngBoundsExpression = [
      [0, 0],                          // top-left corner
      [IMAGE_HEIGHT, IMAGE_WIDTH]      // bottom-right corner
    ];

    // Add initial floor image
    const overlay = L.imageOverlay(getFloorImageUrl(currentFloor), bounds);
    overlay.addTo(map);
    imageOverlay.current = overlay;

    // Set map bounds for panning
    map.setMaxBounds([
      [-200, -200],
      [IMAGE_HEIGHT + 200, IMAGE_WIDTH + 200]
    ]);

    // Convert target coordinates to Leaflet position
    const markerPos = worldToLeaflet(x, y);

    console.log(`Map: World (${x}, ${y}, ${z}) -> Leaflet`, markerPos);

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
