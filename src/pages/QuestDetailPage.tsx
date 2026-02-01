import { useParams, Link } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import { useTranslation } from "@/i18n";
import { getQuestBySlug } from "@/data/quests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import QuestDialogue from "@/components/QuestDialogue";
import ImageGallery from "@/components/ImageGallery";
import { ArrowLeft, Crown, Scroll, MapPin, MessageSquare, Image, FileText, CheckCircle } from "lucide-react";
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/quests">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Scroll className="w-6 h-6 text-gold" />
              <h1 className="text-2xl md:text-3xl font-bold text-maroon">
                {quest.title[language]}
              </h1>
              {quest.premium && <Crown className="w-5 h-5 text-gold" />}
            </div>
            <p className="text-muted-foreground mt-1">
              {quest.description[language]}
            </p>
          </div>
        </div>

        {/* Requirements */}
        <Card>
          <CardHeader className="news-box-header">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5" />
              {t('quests.requirements')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="list-disc list-inside space-y-1">
              {quest.requirements.items.map((item, i) => (
                <li key={i} className="text-foreground">{item[language]}</li>
              ))}
              {quest.requirements.other?.map((item, i) => (
                <li key={`other-${i}`} className="text-foreground">{item[language]}</li>
              ))}
            </ul>
            {quest.premium && (
              <Badge className="mt-3 bg-gold text-background">
                <Crown className="w-3 h-3 mr-1" />
                {t('quests.premium')}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Rewards */}
        {quest.rewards && quest.rewards.length > 0 && (
          <Card>
            <CardHeader className="news-box-header">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scroll className="w-5 h-5" />
                {t('quests.rewards')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="list-disc list-inside space-y-1">
                {quest.rewards.map((reward, i) => (
                  <li key={i} className="text-foreground">{reward[language]}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Quest Sections */}
        {quest.sections.map((section, index) => (
          <Card key={index}>
            {section.title && (
              <CardHeader className="news-box-header">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {section.type === 'dialogue' && <MessageSquare className="w-5 h-5" />}
                  {section.type === 'images' && <Image className="w-5 h-5" />}
                  {section.type === 'text' && <FileText className="w-5 h-5" />}
                  {section.type === 'map' && <MapPin className="w-5 h-5" />}
                  {section.title[language]}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className={section.title ? "pt-4" : "pt-6"}>
              {/* Text content */}
              {section.type === 'text' && section.content && (
                <div className="space-y-3">
                  <p className="text-foreground leading-relaxed">
                    {section.content[language]}
                  </p>
                  {section.mapCoordinates && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openMap(section.mapCoordinates!)}
                      className="mt-2"
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

              {/* Images */}
              {section.type === 'images' && section.images && (
                <ImageGallery images={section.images} alt={quest.title[language]} />
              )}

              {/* Map */}
              {section.type === 'map' && section.mapCoordinates && (
                <Button 
                  variant="outline" 
                  onClick={() => openMap(section.mapCoordinates!)}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {t('navigation.map')}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Back button */}
        <div className="pt-4">
          <Link to="/quests">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('quests.backToList')}
            </Button>
          </Link>
        </div>
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
