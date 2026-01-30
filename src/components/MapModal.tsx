import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MapViewer from './MapViewer';
import { MapPin } from 'lucide-react';

interface MapCoordinates {
  x: number;
  y: number;
  z: number;
  zoom?: number;
}

interface MapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: MapCoordinates | null;
  title?: string;
}

// Parse coordinates from URL hash format: #X,Y,Z:ZOOM or #X,Y,Z
export function parseMapCoordinates(url: string): MapCoordinates | null {
  try {
    // Extract hash part
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return null;
    
    const hash = url.substring(hashIndex + 1);
    
    // Parse format: X,Y,Z:ZOOM or X,Y,Z
    const parts = hash.split(':');
    const coords = parts[0].split(',');
    
    if (coords.length < 3) return null;
    
    const x = parseInt(coords[0], 10);
    const y = parseInt(coords[1], 10);
    const z = parseInt(coords[2], 10);
    const zoom = parts[1] ? parseInt(parts[1], 10) : 2;
    
    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
    
    return { x, y, z, zoom };
  } catch {
    return null;
  }
}

const MapModal = ({ open, onOpenChange, coordinates, title = 'Localização no Mapa' }: MapModalProps) => {
  if (!coordinates) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-parchment border-2 border-maroon/30 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 font-heading text-maroon">
            <MapPin className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-4 pb-4">
          <MapViewer
            x={coordinates.x}
            y={coordinates.y}
            z={coordinates.z}
            className="h-[500px] rounded-sm border border-border"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MapModal;
