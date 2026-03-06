import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Film } from 'lucide-react';
import { useTranslation } from '@/i18n';
import TibiarcPlayer from '@/components/TibiarcPlayer';
import JsCamPlayer from '@/components/JsCamPlayer';
import CamFrameDebugger from '@/components/CamFrameDebugger';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const CamPlayerPage = () => {
  const { t } = useTranslation();
  const [activeEngine, setActiveEngine] = useState<'wasm' | 'typescript'>('wasm');
  const [debugState, setDebugState] = useState<{ camBuffer: Uint8Array | null; progress: number; isPlaying: boolean }>({
    camBuffer: null, progress: 0, isPlaying: false,
  });
  const [wasmVersion, setWasmVersion] = useState<string | null>(null);
  const [camFileName, setCamFileName] = useState<string | null>(null);

  const handleStateChange = useCallback((info: { camBuffer: Uint8Array | null; progress: number; isPlaying: boolean }) => {
    setDebugState(info);
  }, []);

  useEffect(() => {
    const title = `${t('camPlayer.title')} — Tibia Relic Wiki`;
    document.title = title;
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const observer = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
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
            {camFileName && (
              <Badge variant="outline" className="text-[10px] text-foreground border-gold/40 font-mono bg-gold/10">
                {camFileName}
              </Badge>
            )}
            {wasmVersion && activeEngine === 'wasm' && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50 font-mono">
                WASM {wasmVersion}
              </Badge>
            )}
            {activeEngine === 'typescript' && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50 font-mono">
                TypeScript Engine
              </Badge>
            )}
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
        <Tabs value={activeEngine} onValueChange={(v) => setActiveEngine(v as 'wasm' | 'typescript')} className="w-full max-w-[960px]">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="wasm" className="data-[state=active]:text-gold">
              ⚡ WASM Engine
            </TabsTrigger>
            <TabsTrigger value="typescript" className="data-[state=active]:text-gold">
              🔧 TypeScript Engine
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wasm">
            <TibiarcPlayer className="w-full" onStateChange={handleStateChange} onWasmVersion={setWasmVersion} onFileNameChange={setCamFileName} />
          </TabsContent>

          <TabsContent value="typescript">
            <JsCamPlayer className="w-full" onStateChange={handleStateChange} onFileNameChange={setCamFileName} />
          </TabsContent>
        </Tabs>

        {/* Frame Debugger */}
        <CamFrameDebugger
          camBuffer={debugState.camBuffer}
          progress={debugState.progress}
          isPlaying={debugState.isPlaying}
        />
      </div>
    </div>
  );
};

export default CamPlayerPage;
