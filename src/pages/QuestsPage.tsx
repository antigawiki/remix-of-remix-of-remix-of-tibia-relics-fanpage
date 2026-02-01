import MainLayout from "@/layouts/MainLayout";
import { Scroll } from "lucide-react";
import { useTranslation } from "@/i18n";
import { quests } from "@/data/quests";
import QuestCard from "@/components/QuestCard";

const QuestsPage = () => {
  const { t, language } = useTranslation();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Scroll className="w-8 h-8 text-gold" />
          <h1 className="text-2xl md:text-3xl font-bold text-maroon">
            {t('quests.title')}
          </h1>
        </div>

        {/* Quest Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quests.map((quest) => (
            <QuestCard
              key={quest.id}
              slug={quest.slug}
              title={quest.title[language]}
              description={quest.description[language]}
              level={quest.level}
              premium={quest.premium}
              available={quest.available}
            />
          ))}
        </div>

        {/* Info about more quests coming */}
        {quests.length < 5 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('quests.communityHelp')}</p>
            <p className="text-sm italic mt-2">{t('quests.contactUs')}</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default QuestsPage;
