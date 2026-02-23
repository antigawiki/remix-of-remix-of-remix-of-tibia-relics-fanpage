import { Link } from 'react-router-dom';
import { ArrowLeft, Film } from 'lucide-react';
import { useTranslation } from '@/i18n';
import TibiarcPlayer from '@/components/TibiarcPlayer';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';

const CamPlayerPage = () => {
  const { t } = useTranslation();

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
        <p className="text-sm text-muted-foreground max-w-[800px] mx-auto text-center">
          {t('camPlayer.description')}
        </p>
      </div>

      {/* Player */}
      <div className="flex-1 flex items-start justify-center p-4 pt-6">
        <TibiarcPlayer className="w-full max-w-[850px]" />
      </div>
    </div>
  );
};

export default CamPlayerPage;
