import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useRuneDetails } from '@/hooks/useRuneDetails';
import { useTranslation } from '@/i18n';
import { Rune } from '@/data/runes';
import { Clock, Utensils } from 'lucide-react';

interface RuneDetailsModalProps {
  rune: Rune | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RuneDetailsModal = ({ rune, open, onOpenChange }: RuneDetailsModalProps) => {
  const { t } = useTranslation();
  const { data: details, isLoading, isError } = useRuneDetails(rune?.id ?? null);

  if (!rune) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="parchment-bg max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-foreground">
            <img
              src={rune.image}
              alt={rune.name}
              className="w-10 h-10 object-contain"
            />
            <span>{rune.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-muted/50 rounded p-2 text-center">
              <div className="text-muted-foreground text-xs">{t('pages.runes.spell')}</div>
              <div className="font-mono text-foreground">{rune.spell}</div>
            </div>
            <div className="bg-muted/50 rounded p-2 text-center">
              <div className="text-muted-foreground text-xs">{t('tables.columns.mana')}</div>
              <div className="font-semibold text-gold">{rune.mana}</div>
            </div>
            <div className="bg-muted/50 rounded p-2 text-center">
              <div className="text-muted-foreground text-xs">{t('pages.runes.mlvlCast')}</div>
              <div className="font-semibold text-foreground">{rune.mlvlCast}</div>
            </div>
            <div className="bg-muted/50 rounded p-2 text-center">
              <div className="text-muted-foreground text-xs">{t('pages.runes.charges')}</div>
              <div className="font-semibold text-foreground">{rune.charges}</div>
            </div>
          </div>

          {/* Vocation Details */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="border border-border/50 rounded-lg p-4">
                  <Skeleton className="h-6 w-40 mb-3" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center text-muted-foreground py-4">
              {t('common.error')}
            </div>
          ) : details?.vocations && details.vocations.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-heading text-lg text-foreground flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                {t('pages.runes.backpackProduction')}
              </h3>
              {details.vocations.map((voc) => (
                <div
                  key={voc.vocation}
                  className="border border-border/50 rounded-lg p-4 bg-background/50"
                >
                  <h4 className="font-semibold text-foreground mb-2 uppercase tracking-wide">{voc.vocation}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Clock className="w-4 h-4" />
                    <span>{t('pages.runes.timeToMake')}: <span className="text-foreground font-medium">{voc.time}</span></span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">{t('pages.runes.foodNeeded')}:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {voc.foods.map((food, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2"
                      >
                        <img
                          src={food.image}
                          alt={food.name}
                          className="w-8 h-8 object-contain flex-shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-foreground leading-tight truncate" title={food.name}>
                            {food.name}
                          </span>
                          <span className="text-gold font-bold text-sm">x{food.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              {t('pages.runes.noProductionData')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RuneDetailsModal;
