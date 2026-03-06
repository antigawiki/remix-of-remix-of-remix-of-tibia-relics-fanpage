import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Film, Info } from 'lucide-react';
import { useTranslation } from '@/i18n';
import TibiarcPlayer from '@/components/TibiarcPlayer';
import CamFrameDebugger from '@/components/CamFrameDebugger';
import PacketDissector from '@/components/PacketDissector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';

const CamPlayerPage = () => {
  const { t } = useTranslation();
  const [debugState, setDebugState] = useState<{ camBuffer: Uint8Array | null; progress: number; isPlaying: boolean }>({
    camBuffer: null, progress: 0, isPlaying: false,
  });

  const handleStateChange = useCallback((info: { camBuffer: Uint8Array | null; progress: number; isPlaying: boolean }) => {
    setDebugState(info);
  }, []);

  // WASM module sets document.title to "tibiarc" — use MutationObserver to revert instantly
  useEffect(() => {
    const title = `${t('camPlayer.title')} — Tibia Relic Wiki`;
    document.title = title;

    const titleEl = document.querySelector('title');
    if (!titleEl) return;

    const observer = new MutationObserver(() => {
      if (document.title !== title) {
        document.title = title;
      }
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [t]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="bg-card border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gold hover:text-gold/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-gold" />
            <h1 className="font-heading text-lg text-gold">{t('camPlayer.title')}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3 bg-card/50 border-b border-border/30">
        <p className="text-sm text-muted-foreground max-w-[960px] mx-auto text-center">
          {t('camPlayer.description')}
        </p>
      </div>

      {/* Player */}
      <div className="flex-1 flex flex-col items-center p-4 pt-6 gap-6">
        <TibiarcPlayer className="w-full max-w-[960px]" onStateChange={handleStateChange} />

        {/* Debugger tools */}
        <div className="w-full max-w-[960px] flex gap-2 flex-wrap">
          <CamFrameDebugger
            camBuffer={debugState.camBuffer}
            progress={debugState.progress}
            isPlaying={debugState.isPlaying}
          />
          <PacketDissector
            camBuffer={debugState.camBuffer}
            progress={debugState.progress}
            isPlaying={debugState.isPlaying}
          />
        </div>

        {/* Info box */}
        <div className="w-full max-w-[960px] bg-card border border-border/50 rounded-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-gold">
            <Info className="w-4 h-4" />
            <h2 className="font-heading text-sm">{t('camPlayer.aboutTitle')}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{t('camPlayer.aboutDescription')}</p>
        </div>
      </div>
    </div>
  );
};

export default CamPlayerPage;
