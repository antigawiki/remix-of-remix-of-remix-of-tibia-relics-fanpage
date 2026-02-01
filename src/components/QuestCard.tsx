import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scroll, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface QuestCardProps {
  slug: string;
  title: string;
  description: string;
  level?: number;
  premium?: boolean;
  available?: boolean;
}

const QuestCard = ({ slug, title, description, level, premium, available = true }: QuestCardProps) => {
  const { t } = useTranslation();

  return (
    <Link to={`/quests/${slug}`} className="block group">
      <Card className={cn(
        "h-full transition-all duration-200 hover:border-gold hover:shadow-lg",
        !available && "opacity-60"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Scroll className="w-5 h-5 text-gold shrink-0" />
              <CardTitle className="text-base font-semibold text-maroon group-hover:text-gold transition-colors">
                {title}
              </CardTitle>
            </div>
            {premium && (
              <Crown className="w-4 h-4 text-gold shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {level && (
              <Badge variant="secondary" className="text-xs">
                {t('quests.recommended')}: {level}+
              </Badge>
            )}
            <Badge 
              variant={available ? "default" : "outline"} 
              className={cn(
                "text-xs",
                available ? "bg-green-600 hover:bg-green-700" : ""
              )}
            >
              {available ? t('quests.available') : t('quests.comingSoon')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default QuestCard;
