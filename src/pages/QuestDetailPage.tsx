import { useParams, Link } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import { useTranslation } from "@/i18n";
import { getQuestBySlug } from "@/data/quests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import QuestDialogue from "@/components/QuestDialogue";
import ImageGallery from "@/components/ImageGallery";
import { ArrowLeft, Crown, Scroll, MapPin, MessageSquare, Image, FileText, CheckCircle, Gift } from "lucide-react";
import { useState } from "react";
import MapModal from "@/components/MapModal";

const QuestDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useTranslation();
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ x: number; y: number; z: number; zoom?: number } | null>(null);

  const quest = slug ? getQuestBySlug(slug) : undefined;

  const openMap = (coords: { x: number; y: number; z: number; zoom?: number }) => {
    setMapCoords(coords);
    setMapOpen(true);
  };

  if (!quest) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-maroon mb-4">{t('common.notFound')}</h1>
          <Link to="/quests">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('quests.backToList')}
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Back Button */}
        <Link to="/quests">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('quests.backToList')}
          </Button>
        </Link>

        {/* Main Quest Container */}
        <article className="news-box">
          {/* Header */}
          <header className="news-box-header">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Scroll className="w-5 h-5" />
                <h1 className="font-semibold text-lg">{quest.title[language]}</h1>
              </div>
              {quest.premium && (
                <Badge className="bg-gold text-background text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  {t('quests.premium')}
                </Badge>
              )}
            </div>
          </header>

          {/* Content */}
          <div className="news-box-content space-y-6">
            {/* Description */}
            <p className="text-text-dark leading-relaxed">
              {quest.description[language]}
            </p>

            <Separator />

            {/* Requirements */}
            <section>
              <h2 className="flex items-center gap-2 font-semibold text-maroon mb-3">
                <CheckCircle className="w-4 h-4" />
                {t('quests.requirements')}
              </h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {quest.requirements.items.map((item, i) => (
                  <li key={i} className="text-text-dark">{item[language]}</li>
                ))}
                {quest.requirements.other?.map((item, i) => (
                  <li key={`other-${i}`} className="text-text-dark">{item[language]}</li>
                ))}
              </ul>
            </section>

            {/* Rewards */}
            {quest.rewards && quest.rewards.length > 0 && (
              <>
                <Separator />
                <section>
                  <h2 className="flex items-center gap-2 font-semibold text-maroon mb-3">
                    <Gift className="w-4 h-4" />
                    {t('quests.rewards')}
                  </h2>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    {quest.rewards.map((reward, i) => (
                      <li key={i} className="text-text-dark">{reward[language]}</li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* Quest Sections */}
            {quest.sections.map((section, index) => (
              <div key={index}>
                <Separator />
                <section className="pt-4">
                  {/* Section Title */}
                  {section.title && (
                    <h3 className="flex items-center gap-2 font-semibold text-maroon mb-3">
                      {section.type === 'dialogue' && <MessageSquare className="w-4 h-4" />}
                      {section.type === 'images' && <Image className="w-4 h-4" />}
                      {section.type === 'text' && <FileText className="w-4 h-4" />}
                      {section.type === 'map' && <MapPin className="w-4 h-4" />}
                      {section.title[language]}
                    </h3>
                  )}

                  {/* Text content */}
                  {section.type === 'text' && section.content && (
                    <div className="space-y-4">
                      <p className="text-text-dark leading-relaxed">
                        {section.content[language]}
                      </p>
                      
                      {/* Images inline with text */}
                      {section.images && section.images.length > 0 && (
                        <ImageGallery images={section.images} alt={section.title?.[language] || quest.title[language]} />
                      )}
                      
                      {/* Map button */}
                      {section.mapCoordinates && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openMap(section.mapCoordinates!)}
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          {t('navigation.map')}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Dialogue */}
                  {section.type === 'dialogue' && section.dialogue && (
                    <QuestDialogue lines={section.dialogue} />
                  )}

                  {/* Images only */}
                  {section.type === 'images' && section.images && (
                    <ImageGallery images={section.images} alt={section.title?.[language] || quest.title[language]} />
                  )}

                  {/* Map only */}
                  {section.type === 'map' && section.mapCoordinates && (
                    <Button 
                      variant="outline" 
                      onClick={() => openMap(section.mapCoordinates!)}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {t('navigation.map')}
                    </Button>
                  )}
                </section>
              </div>
            ))}
          </div>
        </article>

        {/* Bottom Back Button */}
        <Link to="/quests">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('quests.backToList')}
          </Button>
        </Link>
      </div>

      {/* Map Modal */}
      <MapModal
        open={mapOpen}
        onOpenChange={setMapOpen}
        coordinates={mapCoords}
      />
    </MainLayout>
  );
};

export default QuestDetailPage;
