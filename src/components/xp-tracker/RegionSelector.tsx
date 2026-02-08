import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, RotateCcw, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { Region } from '@/hooks/useRegionSelector';

interface RegionSelectorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onRegionSelected: (region: Region) => void;
  onCancel: () => void;
  savedRegion?: Region | null;
}

export const RegionSelector = ({
  videoRef,
  onRegionSelected,
  onCancel,
  savedRegion,
}: RegionSelectorProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(savedRegion || null);
  const [scale, setScale] = useState(1);

  // Draw video frame to canvas
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const updateCanvas = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Scale down for display
      const maxWidth = 800;
      const videoWidth = video.videoWidth || 1920;
      const videoHeight = video.videoHeight || 1080;
      const displayScale = Math.min(1, maxWidth / videoWidth);
      
      canvas.width = videoWidth * displayScale;
      canvas.height = videoHeight * displayScale;
      setScale(displayScale);

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw current selection
      if (currentRegion) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          currentRegion.x * displayScale,
          currentRegion.y * displayScale,
          currentRegion.width * displayScale,
          currentRegion.height * displayScale
        );
        
        // Fill with semi-transparent overlay
        ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
        ctx.fillRect(
          currentRegion.x * displayScale,
          currentRegion.y * displayScale,
          currentRegion.width * displayScale,
          currentRegion.height * displayScale
        );
      }
    };

    updateCanvas();
    const interval = setInterval(updateCanvas, 100);
    return () => clearInterval(interval);
  }, [videoRef, currentRegion]);

  const getMousePosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    return { x: Math.round(x), y: Math.round(y) };
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    if (!pos) return;

    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentRegion(null);
  }, [getMousePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const pos = getMousePosition(e);
    if (!pos) return;

    const x = Math.min(startPoint.x, pos.x);
    const y = Math.min(startPoint.y, pos.y);
    const width = Math.abs(pos.x - startPoint.x);
    const height = Math.abs(pos.y - startPoint.y);

    setCurrentRegion({ x, y, width, height });
  }, [isDrawing, startPoint, getMousePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setStartPoint(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (currentRegion && currentRegion.width >= 50 && currentRegion.height >= 20) {
      onRegionSelected(currentRegion);
    }
  }, [currentRegion, onRegionSelected]);

  const handleReset = useCallback(() => {
    setCurrentRegion(null);
  }, []);

  const isValidRegion = currentRegion && currentRegion.width >= 50 && currentRegion.height >= 20;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Crosshair className="w-4 h-4 text-gold" />
        <span>{t('xpTracker.regionSelector.instruction')}</span>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-black/50 rounded-sm overflow-hidden mx-auto"
        style={{ maxWidth: '800px' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-auto cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {!currentRegion && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 px-4 py-2 rounded text-gold text-sm">
              {t('xpTracker.regionSelector.dragHint')}
            </div>
          </div>
        )}
      </div>

      {currentRegion && (
        <div className="text-xs text-muted-foreground text-center">
          {t('xpTracker.regionSelector.selectedSize')}: {currentRegion.width} x {currentRegion.height} px
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={!currentRegion}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('xpTracker.regionSelector.reset')}
        </Button>
        
        <Button
          onClick={handleConfirm}
          disabled={!isValidRegion}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Check className="w-4 h-4 mr-2" />
          {t('xpTracker.regionSelector.confirm')}
        </Button>

        <Button
          variant="outline"
          onClick={onCancel}
        >
          {t('common.close')}
        </Button>
      </div>

      {currentRegion && !isValidRegion && (
        <p className="text-xs text-destructive text-center">
          {t('xpTracker.regionSelector.tooSmall')}
        </p>
      )}
    </div>
  );
};
