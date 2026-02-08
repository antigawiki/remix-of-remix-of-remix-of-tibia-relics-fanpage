import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, PictureInPicture2, AlertCircle, Loader2, Settings2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/i18n';
import { useScreenCapture } from '@/hooks/useScreenCapture';
import { useRegionSelector } from '@/hooks/useRegionSelector';
import { useXpOcr } from '@/hooks/useXpOcr';
import { useXpTracker } from '@/hooks/useXpTracker';
import { XpDashboard } from '@/components/xp-tracker/XpDashboard';
import { PipPanel } from '@/components/xp-tracker/PipPanel';
import { RegionSelector } from '@/components/xp-tracker/RegionSelector';

const OCR_INTERVAL_MS = 5000; // Increased from 3s to 5s for better performance

type TrackerPhase = 'idle' | 'selecting-region' | 'tracking';

export const WebXpTracker = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [phase, setPhase] = useState<TrackerPhase>('idle');
  const ocrIntervalRef = useRef<number | null>(null);

  const { 
    isInitialized: ocrReady, 
    isProcessing: ocrProcessing, 
    initWorker, 
    recognizeXp, 
    terminateWorker 
  } = useXpOcr();

  const {
    region,
    isSelecting,
    hasSavedRegion,
    startSelection,
    saveRegion,
    clearRegion,
    cancelSelection,
  } = useRegionSelector();
  
  const { 
    state: trackerState, 
    isTracking, 
    startTracking, 
    stopTracking, 
    updateXp, 
    resetTracking, 
    formatDuration, 
    formatXp, 
    getProjection 
  } = useXpTracker();

  const handleStreamEnded = useCallback(() => {
    stopTracking();
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current);
      ocrIntervalRef.current = null;
    }
    setIsPipOpen(false);
    setPhase('idle');
    toast({
      title: t('xpTracker.title'),
      description: t('xpTracker.stopped'),
    });
  }, [stopTracking, toast, t]);

  const { 
    isCapturing, 
    error: captureError, 
    startCapture, 
    stopCapture, 
    captureFrame, 
    videoRef 
  } = useScreenCapture({ onStreamEnded: handleStreamEnded });

  useEffect(() => {
    return () => {
      terminateWorker();
      if (ocrIntervalRef.current) {
        clearInterval(ocrIntervalRef.current);
      }
    };
  }, [terminateWorker]);

  // OCR loop - now uses region for cropped capture
  useEffect(() => {
    if (phase === 'tracking' && isCapturing && ocrReady && isTracking) {
      ocrIntervalRef.current = window.setInterval(async () => {
        const frame = captureFrame(region);
        if (frame) {
          const xp = await recognizeXp(frame);
          if (xp !== null) {
            updateXp(xp);
          }
        }
      }, OCR_INTERVAL_MS);

      return () => {
        if (ocrIntervalRef.current) {
          clearInterval(ocrIntervalRef.current);
        }
      };
    }
  }, [phase, isCapturing, ocrReady, isTracking, captureFrame, recognizeXp, updateXp, region]);

  const handleStart = useCallback(async () => {
    try {
      setIsInitializing(true);
      resetTracking();
      
      if (!ocrReady) {
        await initWorker();
      }
      
      await startCapture();
      
      // If no saved region, go to selection phase
      if (!hasSavedRegion) {
        setPhase('selecting-region');
        startSelection();
      } else {
        // Use saved region, start tracking immediately
        setPhase('tracking');
        startTracking();
        
        if (window.documentPictureInPicture) {
          setIsPipOpen(true);
        }
        
        toast({
          title: t('xpTracker.title'),
          description: t('xpTracker.started'),
        });
      }
    } catch (error) {
      console.error('Failed to start XP Tracker:', error);
      toast({
        title: t('common.error'),
        description: t('xpTracker.noPermission'),
        variant: 'destructive',
      });
      setPhase('idle');
    } finally {
      setIsInitializing(false);
    }
  }, [ocrReady, initWorker, startCapture, startTracking, resetTracking, hasSavedRegion, startSelection, toast, t]);

  const handleRegionConfirmed = useCallback((selectedRegion: typeof region) => {
    if (selectedRegion) {
      saveRegion(selectedRegion);
    }
    setPhase('tracking');
    startTracking();
    
    if (window.documentPictureInPicture) {
      setIsPipOpen(true);
    }
    
    toast({
      title: t('xpTracker.title'),
      description: t('xpTracker.started'),
    });
  }, [saveRegion, startTracking, toast, t]);

  const handleChangeRegion = useCallback(() => {
    setPhase('selecting-region');
    startSelection();
  }, [startSelection]);

  const handleCancelSelection = useCallback(() => {
    cancelSelection();
    if (hasSavedRegion) {
      setPhase('tracking');
      startTracking();
    } else {
      stopCapture();
      setPhase('idle');
    }
  }, [cancelSelection, hasSavedRegion, startTracking, stopCapture]);

  const handleStop = useCallback(() => {
    stopCapture();
    stopTracking();
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current);
    }
    setPhase('idle');
    toast({
      title: t('xpTracker.title'),
      description: t('xpTracker.stopped'),
    });
  }, [stopCapture, stopTracking, toast, t]);

  const handlePipToggle = useCallback(() => {
    if (!window.documentPictureInPicture) {
      toast({
        title: t('common.error'),
        description: t('xpTracker.pipNotSupported'),
        variant: 'destructive',
      });
      return;
    }
    setIsPipOpen(prev => !prev);
  }, [toast, t]);

  const isPipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  return (
    <div className="space-y-4">
      {/* Browser compatibility warning */}
      {!isPipSupported && (
        <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-sm">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">{t('xpTracker.pipNotSupported')}</p>
        </div>
      )}

      {/* Capture error */}
      {captureError && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{captureError}</p>
        </div>
      )}

      {/* Saved region indicator */}
      {hasSavedRegion && phase === 'idle' && (
        <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded-sm">
          <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
          <span className="text-sm text-accent flex-1">{t('xpTracker.regionSelector.usingRegion')}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearRegion}
            className="text-muted-foreground hover:text-foreground"
          >
            {t('xpTracker.regionSelector.changeRegion')}
          </Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {phase === 'idle' ? (
          <Button
            onClick={handleStart}
            disabled={isInitializing}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isInitializing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('xpTracker.processing')}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                {t('xpTracker.startButton')}
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleStop}
              variant="destructive"
            >
              <Square className="w-4 h-4 mr-2" />
              {t('xpTracker.stopButton')}
            </Button>
            
            {phase === 'tracking' && (
              <>
                {isPipSupported && (
                  <Button
                    onClick={handlePipToggle}
                    variant="secondary"
                  >
                    <PictureInPicture2 className="w-4 h-4 mr-2" />
                    {t('xpTracker.floatingMode')}
                  </Button>
                )}
                
                <Button
                  onClick={handleChangeRegion}
                  variant="outline"
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  {t('xpTracker.regionSelector.changeRegion')}
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* Video preview (hidden but needed for capture) */}
      <video 
        ref={videoRef} 
        className="hidden"
        muted 
        playsInline
      />

      {/* Region selector phase */}
      {phase === 'selecting-region' && isCapturing && (
        <div className="bg-muted/30 rounded-sm overflow-hidden p-4">
          <RegionSelector
            videoRef={videoRef}
            onRegionSelected={handleRegionConfirmed}
            onCancel={handleCancelSelection}
            savedRegion={region}
          />
        </div>
      )}

      {/* Preview section when tracking */}
      {phase === 'tracking' && isCapturing && (
        <div className="bg-muted/30 rounded-sm overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b border-border/50">
            <span className="font-heading text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {t('xpTracker.capturing')}
              {ocrProcessing && (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              )}
            </span>
          </div>
          <div className="p-4">
            <div className="aspect-video max-w-md mx-auto bg-black/50 rounded overflow-hidden mb-4">
              <video 
                ref={(el) => {
                  if (el && videoRef.current?.srcObject) {
                    el.srcObject = videoRef.current.srcObject;
                    el.play();
                  }
                }}
                className="w-full h-full object-contain"
                muted 
                playsInline
              />
            </div>
            
            {region && (
              <p className="text-xs text-muted-foreground text-center mb-2">
                {t('xpTracker.regionSelector.selectedSize')}: {region.width} x {region.height} px
              </p>
            )}
            
            <p className="text-sm text-muted-foreground text-center">
              {t('xpTracker.selectWindow')}
            </p>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {(isTracking || trackerState.xpGained > 0 || trackerState.sessionDuration > 0) && (
        <XpDashboard 
          state={trackerState}
          formatDuration={formatDuration}
          formatXp={formatXp}
          getProjection={getProjection}
          isPaused={!isTracking && trackerState.sessionDuration > 0}
        />
      )}

      {/* Waiting state */}
      {phase === 'tracking' && isCapturing && !trackerState.currentXp && (
        <div className="bg-muted/30 p-6 rounded-sm text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gold mx-auto mb-3" />
          <p className="text-muted-foreground">{t('xpTracker.waitingCapture')}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('xpTracker.ocrHint')}
          </p>
        </div>
      )}

      {/* Picture-in-Picture Panel */}
      <PipPanel
        state={trackerState}
        formatDuration={formatDuration}
        formatXp={formatXp}
        isOpen={isPipOpen}
        onClose={() => setIsPipOpen(false)}
      />
    </div>
  );
};
