import { useState, useMemo } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Droplets, Coins, Sparkles } from "lucide-react";
import { vocations, calculateMagicLevel, VocationData, MagicLevelResult } from "@/data/calculators/magicLevel";
import { useTranslation } from "@/i18n";

interface VocationCardProps {
  vocation: VocationData;
  isSelected: boolean;
  onSelect: () => void;
}

const VocationCard = ({ vocation, isSelected, onSelect }: VocationCardProps) => (
  <button
    onClick={onSelect}
    className={`p-3 rounded border-2 transition-all text-center ${
      isSelected ? "border-maroon bg-maroon/10 text-maroon" : "border-border-light bg-cream hover:border-maroon/50"
    }`}
  >
    <span className="font-medium text-sm">{vocation.name}</span>
  </button>
);

interface ResultCardProps {
  icon?: React.ReactNode;
  title: string;
  value: string;
  description?: string;
  imageUrl?: string;
}

const ResultCard = ({ icon, title, value, description, imageUrl }: ResultCardProps) => (
  <div className="bg-cream border border-border-light rounded p-4 flex items-start gap-3">
    {imageUrl ? (
      <img src={imageUrl} alt={title} className="w-8 h-8 object-contain" />
    ) : (
      <div className="text-maroon">{icon}</div>
    )}
    <div className="flex-1">
      <h4 className="text-xs text-muted-foreground mb-1">{title}</h4>
      <p className="font-semibold text-maroon">{value}</p>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  </div>
);

const MagicLevelCalculator = () => {
  const { t } = useTranslation();
  const [selectedVocation, setSelectedVocation] = useState<VocationData | null>(null);
  const [hasPromotion, setHasPromotion] = useState(false);
  const [currentML, setCurrentML] = useState("");
  const [percentageToNext, setPercentageToNext] = useState("");
  const [desiredML, setDesiredML] = useState("");
  const [showResults, setShowResults] = useState(false);

  const result = useMemo<MagicLevelResult | null>(() => {
    if (!selectedVocation || !currentML || !percentageToNext || !desiredML) {
      return null;
    }

    const current = parseInt(currentML);
    const percentage = parseInt(percentageToNext);
    const desired = parseInt(desiredML);

    if (isNaN(current) || isNaN(percentage) || isNaN(desired)) {
      return null;
    }

    if (desired <= current) {
      return null;
    }

    return calculateMagicLevel(selectedVocation, current, percentage, desired, hasPromotion);
  }, [selectedVocation, currentML, percentageToNext, desiredML, hasPromotion]);

  const handleCalculate = () => {
    if (result) {
      setShowResults(true);
    }
  };

  const formatNumber = (num: number) => {
    return Math.ceil(num).toLocaleString("pt-BR");
  };

  const formatTime = (time: MagicLevelResult["trainingTime"]) => {
    const parts = [];
    if (time.days > 0) parts.push(`${time.days.toLocaleString("pt-BR")} ${t('calculatorPages.magicLevel.days')}`);
    if (time.hours > 0) parts.push(`${time.hours} ${t('calculatorPages.magicLevel.hours')}`);
    if (time.minutes > 0) parts.push(`${time.minutes} ${t('calculatorPages.magicLevel.minutes')}`);
    if (time.seconds > 0) parts.push(`${time.seconds} ${t('calculatorPages.magicLevel.seconds')}`);
    return parts.join(", ") || `0 ${t('calculatorPages.magicLevel.seconds')}`;
  };

  const isFormValid = selectedVocation && currentML && percentageToNext && desiredML && result;

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {t('calculatorPages.magicLevel.title')}
            </h2>
          </header>
          <div className="news-box-content space-y-6">
            <p className="text-sm mb-4">
              {t('calculatorPages.magicLevel.description')}
            </p>

            {/* Seleção de Vocação */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('calculatorPages.magicLevel.chooseVocation')}:</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {vocations.map((vocation) => (
                  <VocationCard
                    key={vocation.id}
                    vocation={vocation}
                    isSelected={selectedVocation?.id === vocation.id}
                    onSelect={() => setSelectedVocation(vocation)}
                  />
                ))}
              </div>
            </div>

            {/* Checkbox Promoção */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="promotion"
                checked={hasPromotion}
                onCheckedChange={(checked) => setHasPromotion(checked === true)}
              />
              <Label htmlFor="promotion" className="text-sm cursor-pointer">
                {t('calculatorPages.magicLevel.hasPromotion')}
              </Label>
            </div>

            {/* Inputs */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentML" className="text-sm">
                  {t('calculatorPages.magicLevel.currentML')}:
                </Label>
                <Input
                  id="currentML"
                  type="number"
                  placeholder="Ex: 50"
                  value={currentML}
                  onChange={(e) => {
                    setCurrentML(e.target.value);
                    setShowResults(false);
                  }}
                  min={0}
                  className="bg-secondary text-text-dark border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentage" className="text-sm">
                  {t('calculatorPages.magicLevel.percentToNext')}:
                </Label>
                <Input
                  id="percentage"
                  type="number"
                  placeholder="Ex: 75"
                  value={percentageToNext}
                  onChange={(e) => {
                    setPercentageToNext(e.target.value);
                    setShowResults(false);
                  }}
                  min={0}
                  max={100}
                  className="bg-secondary text-text-dark border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desiredML" className="text-sm">
                  {t('calculatorPages.magicLevel.desiredML')}:
                </Label>
                <Input
                  id="desiredML"
                  type="number"
                  placeholder="Ex: 60"
                  value={desiredML}
                  onChange={(e) => {
                    setDesiredML(e.target.value);
                    setShowResults(false);
                  }}
                  min={0}
                  className="bg-secondary text-text-dark border-border"
                />
              </div>
            </div>

            {/* Botão Calcular */}
            <div className="flex justify-center">
              <Button
                onClick={handleCalculate}
                disabled={!isFormValid}
                className="bg-maroon hover:bg-maroon/90 text-white px-8"
              >
                {t('calculatorPages.magicLevel.calculate')}
              </Button>
            </div>

            {/* Resultados */}
            {showResults && result && selectedVocation && (
              <div className="space-y-4 pt-4 border-t border-border-light">
                <h3 className="font-semibold text-maroon flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {t('calculatorPages.magicLevel.results')}
                </h3>

                <div className="grid sm:grid-cols-2 gap-3">
                  <ResultCard
                    icon={<Droplets className="w-6 h-6" />}
                    title={t('calculatorPages.magicLevel.manaNeeded')}
                    value={`${formatNumber(result.manaNeeded)} ${t('calculatorPages.magicLevel.ofMana')}`}
                    description={t('calculatorPages.magicLevel.toReachML').replace('{ml}', desiredML)}
                  />

                  <ResultCard
                    icon={<Clock className="w-6 h-6" />}
                    title={t('calculatorPages.magicLevel.trainingTime')}
                    value={formatTime(result.trainingTime)}
                    description={hasPromotion ? t('calculatorPages.magicLevel.withPromotion') : t('calculatorPages.magicLevel.withoutPromotion')}
                  />

                  <ResultCard
                    imageUrl={selectedVocation.spellImage}
                    title={t('calculatorPages.magicLevel.spellsOf').replace('{spell}', selectedVocation.spellName)}
                    value={`${formatNumber(result.spellCasts)} ${t('calculatorPages.magicLevel.spells')}`}
                    description={t('calculatorPages.magicLevel.costEach').replace('{cost}', String(selectedVocation.spellManaCost))}
                  />

                  <ResultCard
                    imageUrl="https://tibiara.netlify.app/en/img/food/194.gif"
                    title={t('calculatorPages.magicLevel.fishesNeeded')}
                    value={`${formatNumber(result.fishesNeeded)} ${t('calculatorPages.magicLevel.fishes')}`}
                    description={t('calculatorPages.magicLevel.fishesDescription')}
                  />

                  <ResultCard
                    icon={<Coins className="w-6 h-6" />}
                    title={t('calculatorPages.magicLevel.manaFluidsAlt')}
                    value={`${formatNumber(result.manaFluids)} mana fluids`}
                    description={t('calculatorPages.magicLevel.totalCost').replace('{cost}', formatNumber(result.manaFluidsCost))}
                  />
                </div>

                <div className="bg-maroon/5 border border-maroon/20 rounded p-4 text-sm">
                  <p>
                    <strong>{t('calculatorPages.magicLevel.summary')}:</strong> {t('calculatorPages.magicLevel.summaryText')
                      .replace('{mana}', formatNumber(result.manaNeeded))
                      .replace('{ml}', desiredML)
                      .replace('{time}', formatTime(result.trainingTime))}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default MagicLevelCalculator;
