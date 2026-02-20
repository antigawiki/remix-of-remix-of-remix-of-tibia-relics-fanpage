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
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-2">
            <div className="flex items-center gap-2">
              <Scroll className="w-5 h-5" />
              <h2 className="font-semibold">{t("quests.title")}</h2>
            </div>
          </div>
          <div className="p-4 text-foreground">
            <p>{t("quests.pageDescription")}</p>
          </div>
        </div>

        {/* Quest List - Full Width Horizontal Items */}
        <div className="space-y-2">
          {quests.filter(q => !q.hidden).map((quest) => (
            <Link
              key={quest.id}
              to={`/quests/${quest.slug}`}
              className={cn("block group", !quest.available && "opacity-60 pointer-events-none")}
            >
              <div className="wood-panel rounded-sm overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-gold/50">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded bg-maroon/20 flex items-center justify-center">
                      <Scroll className="w-5 h-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-heading font-semibold text-gold group-hover:text-gold-light transition-colors">
                          {quest.title[language]}
                        </h2>
                        {quest.premium && <Crown className="w-4 h-4 text-gold shrink-0" />}
                      </div>
                      <p className="text-sm text-foreground/80 mt-1 line-clamp-2">{quest.description[language]}</p>
                    </div>
                  </div>
                  {/* Right side - Level, Status and Arrow */}
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {quest.level && quest.level > 0 && (
                      <Badge variant="secondary" className="text-xs bg-muted text-foreground">
                        Lvl {quest.level}+
                      </Badge>
                    )}
                    <Badge
                      variant={quest.available ? "default" : "outline"}
                      className={cn(
                        "text-xs",
                        quest.available ? "bg-green-600/90 text-white hover:bg-green-700" : "text-muted-foreground",
                      )}
                    >
                      {quest.available ? t("quests.available") : t("quests.comingSoon")}
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
          <div className="bg-muted/50 border border-border/50 rounded-sm overflow-hidden">
            <div className="p-6 text-center">
              <p className="text-muted-foreground">{t("quests.communityHelp")}</p>
              <p className="text-sm text-gold/80 italic mt-2">{t("quests.contactUs")}</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default QuestsPage;
