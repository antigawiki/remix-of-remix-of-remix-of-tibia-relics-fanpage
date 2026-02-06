import { useState, useRef, useCallback } from 'react';

interface UseScreenCaptureOptions {
  onStreamEnded?: () => void;
}

interface UseScreenCaptureReturn {
  stream: MediaStream | null;
  isCapturing: boolean;
  error: string | null;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  captureFrame: () => ImageData | null;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const useScreenCapture = (options?: UseScreenCaptureOptions): UseScreenCaptureReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onStreamEndedRef = useRef(options?.onStreamEnded);

  // Keep callback ref updated
  onStreamEndedRef.current = options?.onStreamEnded;

  const startCapture = useCallback(async () => {
    try {
      setError(null);
      
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen capture is not supported in this browser');
      }

      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
        } as MediaTrackConstraints,
        audio: false,
      });

      setStream(mediaStream);
      setIsCapturing(true);

      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      // Handle stream end (user stops sharing externally)
      mediaStream.getVideoTracks()[0].onended = () => {
        setStream(null);
        setIsCapturing(false);
        // Notify parent component that stream ended
        onStreamEndedRef.current?.();
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start screen capture';
      setError(errorMessage);
      setIsCapturing(false);
      throw err;
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, [stream]);

  const captureFrame = useCallback((): ImageData | null => {
    if (!videoRef.current || !isCapturing) {
      return null;
    }

    const video = videoRef.current;
    
    // Create canvas if it doesn't exist
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [isCapturing]);

  return {
    stream,
    isCapturing,
    error,
    startCapture,
    stopCapture,
    captureFrame,
    videoRef,
  };
};
