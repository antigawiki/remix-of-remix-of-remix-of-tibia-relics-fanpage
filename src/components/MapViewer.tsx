interface MapViewerProps {
  x: number;
  y: number;
  z: number;
  zoom?: number;
  className?: string;
}

const MapViewer = ({ x, y, z, zoom = 2, className = '' }: MapViewerProps) => {
  // Build the URL with coordinates and zoom - format: #X,Y,Z:ZOOM
  const mapUrl = `https://maprelic.netlify.app/#${x},${y},${z}:${zoom}`;

  return (
    <div className={`relative ${className}`}>
      <iframe
        src={mapUrl}
        className="w-full h-full rounded-sm border-0"
        style={{ minHeight: '400px' }}
        title="Mapa do Tibia"
        loading="lazy"
      />
      
      {/* Coordinates display */}
      <div className="absolute bottom-2 left-2 z-10 bg-parchment/95 rounded-sm border border-border px-2 py-1 shadow-md">
        <span className="text-xs text-text-dark">
          <strong>Posição:</strong> {x}, {y}, {z} | <strong>Zoom:</strong> {zoom}
        </span>
      </div>
    </div>
  );
};

export default MapViewer;
