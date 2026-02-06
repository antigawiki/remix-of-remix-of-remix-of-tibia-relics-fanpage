import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, PictureInPicture2, AlertCircle, Monitor, Loader2 } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/i18n';
import { useScreenCapture } from '@/hooks/useScreenCapture';
import { useXpOcr } from '@/hooks/useXpOcr';
import { useXpTracker } from '@/hooks/useXpTracker';
import { XpDashboard } from '@/components/xp-tracker/XpDashboard';
import { PipPanel } from '@/components/xp-tracker/PipPanel';

const OCR_INTERVAL_MS = 3000; // Run OCR every 3 seconds

const XpTrackerPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const { 
    isCapturing, 
    error: captureError, 
    startCapture, 
    stopCapture, 
    captureFrame, 
    videoRef 
  } = useScreenCapture();
  
  const { 
    isInitialized: ocrReady, 
    isProcessing: ocrProcessing, 
    initWorker, 
    recognizeXp, 
    terminateWorker 
  } = useXpOcr();
  
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

  const [isPipOpen, setIsPipOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const ocrIntervalRef = useRef<number | null>(null);

  // Initialize OCR worker when component mounts
  useEffect(() => {
    return () => {
      terminateWorker();
      if (ocrIntervalRef.current) {
        clearInterval(ocrIntervalRef.current);
      }
    };
  }, [terminateWorker]);

  // Run OCR at intervals when capturing
  useEffect(() => {
    if (isCapturing && ocrReady && isTracking) {
      ocrIntervalRef.current = window.setInterval(async () => {
        const frame = captureFrame();
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
  }, [isCapturing, ocrReady, isTracking, captureFrame, recognizeXp, updateXp]);

  const handleStart = useCallback(async () => {
    try {
      setIsInitializing(true);
      
      // Initialize OCR if not ready
      if (!ocrReady) {
        await initWorker();
      }
      
      // Start screen capture
      await startCapture();
      
      // Start tracking
      startTracking();
      
      // Auto-open PiP if supported so user can switch to game
      if (window.documentPictureInPicture) {
        setIsPipOpen(true);
      }
      
      toast({
        title: t('xpTracker.title'),
        description: t('xpTracker.started'),
      });
    } catch (error) {
      console.error('Failed to start XP Tracker:', error);
      toast({
        title: t('common.error'),
        description: t('xpTracker.noPermission'),
        variant: 'destructive',
      });
    } finally {
      setIsInitializing(false);
    }
  }, [ocrReady, initWorker, startCapture, startTracking, toast, t]);

  const handleStop = useCallback(() => {
    stopCapture();
    stopTracking();
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current);
    }
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
    <MainLayout showSidebars={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="news-box-header">
            <h2 className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              {t('xpTracker.title')}
            </h2>
          </div>
          <div className="p-4">
            <p className="text-muted-foreground mb-4">
              {t('xpTracker.description')}
            </p>

            {/* Browser compatibility warning */}
            {!isPipSupported && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-sm mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-200">{t('xpTracker.pipNotSupported')}</p>
              </div>
            )}

            {/* Capture error */}
            {captureError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-sm mb-4">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{captureError}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {!isCapturing ? (
                <Button
                  onClick={handleStart}
                  disabled={isInitializing}
                  className="bg-green-600 hover:bg-green-700 text-white"
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
                  
                  {isPipSupported && (
                    <Button
                      onClick={handlePipToggle}
                      variant="secondary"
                    >
                      <PictureInPicture2 className="w-4 h-4 mr-2" />
                      {t('xpTracker.floatingMode')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Video preview (hidden but needed for capture) */}
        <video 
          ref={videoRef} 
          className="hidden"
          muted 
          playsInline
        />

        {/* Preview section when capturing */}
        {isCapturing && (
          <div className="wood-panel rounded-sm overflow-hidden">
            <div className="maroon-header px-4 py-2">
              <span className="font-heading text-sm font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {t('xpTracker.capturing')}
                {ocrProcessing && (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                )}
              </span>
            </div>
            <div className="p-4">
              {/* Small preview of the captured screen */}
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
              
              <p className="text-sm text-muted-foreground text-center">
                {t('xpTracker.selectWindow')}
              </p>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {isTracking && (
          <XpDashboard 
            state={trackerState}
            formatDuration={formatDuration}
            formatXp={formatXp}
            getProjection={getProjection}
          />
        )}

        {/* Waiting state */}
        {isCapturing && !trackerState.currentXp && (
          <div className="wood-panel p-6 rounded-sm text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gold mx-auto mb-3" />
            <p className="text-muted-foreground">{t('xpTracker.waitingCapture')}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {t('xpTracker.ocrHint')}
            </p>
          </div>
        )}
      </div>

      {/* Picture-in-Picture Panel */}
      <PipPanel
        state={trackerState}
        formatDuration={formatDuration}
        formatXp={formatXp}
        isOpen={isPipOpen}
        onClose={() => setIsPipOpen(false)}
      />
    </MainLayout>
  );
};

export default XpTrackerPage;
