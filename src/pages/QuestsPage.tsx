import MainLayout from "@/layouts/MainLayout";
import { Scroll, Crown, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { quests } from "@/data/quests";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const QuestsPage = () => {
  const { t, language } = useTranslation();

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="news-box">
          <div className="news-box-header">
            <div className="flex items-center gap-2">
              <Scroll className="w-5 h-5" />
              <h1 className="font-semibold">{t('quests.title')}</h1>
            </div>
          </div>
          <div className="news-box-content">
            <p>{t('quests.pageDescription') || 'Guias completos de quests com walkthroughs detalhados, mapas e diálogos.'}</p>
          </div>
        </div>

        {/* Quest List - Full Width Horizontal Items */}
        <div className="space-y-2">
          {quests.map((quest) => (
            <Link 
              key={quest.id} 
              to={`/quests/${quest.slug}`} 
              className={cn(
                "block group",
                !quest.available && "opacity-60 pointer-events-none"
              )}
            >
              <div className="news-box transition-all duration-200 hover:ring-2 hover:ring-gold/50">
                <div className="flex items-center justify-between p-4">
                  {/* Left side - Icon, Title and Description */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded bg-maroon/20 flex items-center justify-center">
                      <Scroll className="w-5 h-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-heading font-semibold text-maroon dark:text-gold group-hover:text-gold transition-colors">
                          {quest.title[language]}
                        </h2>
                        {quest.premium && (
                          <Crown className="w-4 h-4 text-gold shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-text-dark/80 dark:text-foreground/70 mt-1 line-clamp-2">
                        {quest.description[language]}
                      </p>
                    </div>
                  </div>

                  {/* Right side - Level, Status and Arrow */}
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {quest.level && (
                      <Badge variant="secondary" className="text-xs bg-secondary/80 text-text-dark dark:text-foreground">
                        Lvl {quest.level}+
                      </Badge>
                    )}
                    <Badge 
                      variant={quest.available ? "default" : "outline"} 
                      className={cn(
                        "text-xs",
                        quest.available 
                          ? "bg-green-600/90 text-white hover:bg-green-700" 
                          : "text-muted-foreground"
                      )}
                    >
                      {quest.available ? t('quests.available') : t('quests.comingSoon')}
                    </Badge>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-gold transition-colors" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info about more quests coming */}
        {quests.length < 5 && (
          <div className="news-box">
            <div className="news-box-content text-center py-6">
              <p className="text-text-dark">{t('quests.communityHelp')}</p>
              <p className="text-sm text-text-dark/70 dark:text-foreground/60 italic mt-2">{t('quests.contactUs')}</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default QuestsPage;
