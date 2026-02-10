import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Square,
  PictureInPicture2,
  AlertCircle,
  Monitor,
  Loader2,
  Download,
  Github,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useXpOcr } from "@/hooks/useXpOcr";
import { useXpTracker } from "@/hooks/useXpTracker";
import { XpDashboard } from "@/components/xp-tracker/XpDashboard";
import { PipPanel } from "@/components/xp-tracker/PipPanel";
import { WebXpTracker } from "@/components/xp-tracker/WebXpTracker";

const DOWNLOAD_URL = "https://tibiarelikwiki.netlify.app/RelicHelper.zip";

const XpTrackerPage = () => {
  const { t } = useTranslation();
  const [showWebTracker, setShowWebTracker] = useState(false);

  return (
    <MainLayout showSidebars={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="news-box-header">
            <h2 className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              {t("xpTracker.title")}
            </h2>
          </div>
          <div className="p-4">
            <p className="text-muted-foreground mb-6">{t("xpTracker.description")}</p>

            {/* Desktop App - Primary Option */}
            <div className="bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold/50 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gold/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Download className="w-6 h-6 text-gold" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-heading font-bold text-gold mb-2">{t("xpTracker.desktopApp.title")}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t("xpTracker.desktopApp.description")}
                  </p>
                  <ul className="text-sm text-muted-foreground mb-4 space-y-1">
                    <li>✓ {t("xpTracker.desktopApp.feature1")}</li>
                    <li>✓ {t("xpTracker.desktopApp.feature2")}</li>
                    <li>✓ {t("xpTracker.desktopApp.feature3")}</li>
                    <li>✓ {t("xpTracker.desktopApp.feature4")}</li>
                  </ul>
                  <div className="flex items-center gap-4 flex-wrap">
                    <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button className="bg-gold hover:bg-gold/90 text-black font-semibold">
                        <Download className="w-4 h-4 mr-2" />
                        {t("xpTracker.desktopApp.downloadButton")}
                      </Button>
                    </a>
                    <a href="https://github.com/Josubah/RelicHelper" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Github className="w-4 h-4" />
                      {t("xpTracker.desktopApp.githubLink")}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Web Tracker - Alternative */}
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowWebTracker(!showWebTracker)}
                className="w-full p-4 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-heading font-semibold">{t("xpTracker.webTracker.title")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("xpTracker.webTracker.description")}
                    </p>
                  </div>
                </div>
                {showWebTracker ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {showWebTracker && (
                <div className="p-4 border-t border-border/50">
                  <WebXpTracker />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default XpTrackerPage;
