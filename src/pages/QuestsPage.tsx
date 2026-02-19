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

        {/* quest here */}

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
