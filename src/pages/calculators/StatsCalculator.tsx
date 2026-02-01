import { useState, useMemo } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Heart, Droplets, Package, Sparkles } from "lucide-react";
import { statsVocations, calculateStats, StatsVocationData, StatsResult } from "@/data/calculators/stats";
import { useTranslation } from "@/i18n";

interface VocationCardProps {
  vocation: StatsVocationData;
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
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  iconColor?: string;
}

const ResultCard = ({ icon, title, value, description, iconColor = "text-maroon" }: ResultCardProps) => (
  <div className="bg-cream border border-border-light rounded p-4 flex items-start gap-3">
    <div className={iconColor}>{icon}</div>
    <div className="flex-1">
      <h4 className="text-xs text-muted-foreground mb-1">{title}</h4>
      <p className="font-semibold text-maroon">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  </div>
);

const StatsCalculator = () => {
  const { t } = useTranslation();
  const [selectedVocation, setSelectedVocation] = useState<StatsVocationData | null>(null);
  const [level, setLevel] = useState("");
  const [showResults, setShowResults] = useState(false);

  const result = useMemo<StatsResult | null>(() => {
    if (!selectedVocation || !level) {
      return null;
    }

    const levelNum = parseInt(level);

    if (isNaN(levelNum) || levelNum < 1) {
      return null;
    }

    return calculateStats(selectedVocation, levelNum);
  }, [selectedVocation, level]);

  const handleCalculate = () => {
    if (result) {
      setShowResults(true);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("pt-BR");
  };

  const isFormValid = selectedVocation && level && result;

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold flex items-center gap-2">
              <Heart className="w-5 h-5" />
              {t('calculatorPages.stats.title')}
            </h2>
          </header>
          <div className="news-box-content space-y-6">
            <p className="text-sm mb-4">
              {t('calculatorPages.stats.description')}
            </p>

            {/* Seleção de Vocação */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('calculatorPages.stats.chooseVocation')}:</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {statsVocations.map((vocation) => (
                  <VocationCard
                    key={vocation.id}
                    vocation={vocation}
                    isSelected={selectedVocation?.id === vocation.id}
                    onSelect={() => {
                      setSelectedVocation(vocation);
                      setShowResults(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Input Level */}
            <div className="max-w-xs space-y-2">
              <Label htmlFor="level" className="text-sm">
                {t('calculatorPages.stats.characterLevel')}:
              </Label>
              <Input
                id="level"
                type="number"
                placeholder={t('calculatorPages.stats.enterLevel')}
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  setShowResults(false);
                }}
                min={1}
                className="bg-secondary text-text-dark border-border"
              />
            </div>

            {/* Botão Calcular */}
            <div className="flex justify-center">
              <Button
                onClick={handleCalculate}
                disabled={!isFormValid}
                className="bg-maroon hover:bg-maroon/90 text-white px-8"
              >
                {t('calculatorPages.stats.calculate')}
              </Button>
            </div>

            {/* Resultados */}
            {showResults && result && (
              <div className="space-y-4 pt-4 border-t border-border-light">
                <h3 className="font-semibold text-maroon flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {t('calculatorPages.stats.results')}
                </h3>

                <div className="grid sm:grid-cols-3 gap-3">
                  <ResultCard
                    icon={<Heart className="w-6 h-6" />}
                    iconColor="text-red-600"
                    title={t('calculatorPages.stats.hp')}
                    value={formatNumber(result.hp)}
                    description={t('calculatorPages.stats.totalLife')}
                  />

                  <ResultCard
                    icon={<Droplets className="w-6 h-6" />}
                    iconColor="text-blue-600"
                    title={t('calculatorPages.stats.mp')}
                    value={formatNumber(result.mp)}
                    description={t('calculatorPages.stats.totalMana')}
                  />

                  <ResultCard
                    icon={<Package className="w-6 h-6" />}
                    iconColor="text-amber-700"
                    title={t('calculatorPages.stats.cap')}
                    value={formatNumber(result.cap)}
                    description={t('calculatorPages.stats.carryWeight')}
                  />
                </div>

                <div className="bg-maroon/5 border border-maroon/20 rounded p-4 text-sm">
                  <p>
                    {t('calculatorPages.stats.summary')
                      .replace('{vocation}', result.vocationName)
                      .replace('{level}', String(result.level))
                      .replace('{hp}', formatNumber(result.hp))
                      .replace('{mp}', formatNumber(result.mp))
                      .replace('{cap}', formatNumber(result.cap))}
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

export default StatsCalculator;
