import { useRef, useState, useCallback } from 'react';
import { Upload, Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface TibiarcPlayerProps {
  className?: string;
}

const TibiarcPlayer = ({ className }: TibiarcPlayerProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setFileName(file.name);
    setIsPlaying(false);
  }, [videoUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const resetPlayer = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl('');
    setFileName('');
    setIsPlaying(false);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div
        className="relative w-full aspect-video max-w-[800px] mx-auto bg-black rounded-sm overflow-hidden border-2 border-border/50"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-gold/80">
              {fileName}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
            <Upload className="w-12 h-12 text-gold/60" />
            <div className="text-center space-y-2">
              <p className="text-gold font-heading text-lg">
                {t('camPlayer.dropFile')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('camPlayer.supportedFormats')}
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-2 border-gold/50 text-gold hover:bg-gold/10"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('camPlayer.selectFile')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      {videoUrl && (
        <div className="max-w-[800px] mx-auto w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={togglePlay} className="border-border/50">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleMute} className="border-border/50">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleFullscreen} className="border-border/50">
                <Maximize className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={resetPlayer} className="text-muted-foreground">
              {t('camPlayer.selectFile')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TibiarcPlayer;
