import { useState, useMemo } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Droplets, Fish, Coins, Sparkles } from "lucide-react";
import { vocations, calculateMagicLevel, VocationData, MagicLevelResult } from "@/data/calculators/magicLevel";

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
    if (time.days > 0) parts.push(`${time.days.toLocaleString("pt-BR")} dias`);
    if (time.hours > 0) parts.push(`${time.hours} horas`);
    if (time.minutes > 0) parts.push(`${time.minutes} minutos`);
    if (time.seconds > 0) parts.push(`${time.seconds} segundos`);
    return parts.join(", ") || "0 segundos";
  };

  const isFormValid = selectedVocation && currentML && percentageToNext && desiredML && result;

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Calculadora de Magic Level
            </h2>
          </header>
          <div className="news-box-content space-y-6">
            <p className="text-sm text-muted-foreground">
              Calcule quanto de mana você precisa gastar para atingir o Magic Level desejado, tempo de treino e
              quantidade de magias/runas necessárias.
            </p>

            {/* Seleção de Vocação */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Escolha sua Vocação:</Label>
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
                Se você tem <strong>Promoção</strong>, marque esta caixa
              </Label>
            </div>

            {/* Inputs */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="currentML" className="text-sm">
                  Magic Level Atual:
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
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="percentage" className="text-sm">
                  % para o Próximo ML:
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
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="desiredML" className="text-sm">
                  Magic Level Desejado:
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
                Calcular
              </Button>
            </div>

            {/* Resultados */}
            {showResults && result && selectedVocation && (
              <div className="space-y-4 pt-4 border-t border-border-light">
                <h3 className="font-semibold text-maroon flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Resultados
                </h3>

                <div className="grid sm:grid-cols-2 gap-3">
                  <ResultCard
                    icon={<Droplets className="w-6 h-6" />}
                    title="Mana Necessária"
                    value={`${formatNumber(result.manaNeeded)} de mana`}
                    description={`Para atingir Magic Level ${desiredML}`}
                  />

                  <ResultCard
                    icon={<Clock className="w-6 h-6" />}
                    title="Tempo de Treino"
                    value={formatTime(result.trainingTime)}
                    description={hasPromotion ? "Com promoção" : "Sem promoção"}
                  />

                  <ResultCard
                    imageUrl={selectedVocation.spellImage}
                    title={`Magias de ${selectedVocation.spellName}`}
                    value={`${formatNumber(result.spellCasts)} magias`}
                    description={`Custo: ${selectedVocation.spellManaCost} mana cada`}
                  />

                  <ResultCard
                    imageUrl="https://tibiara.netlify.app/en/img/food/194.gif"
                    title="Peixes Necessários"
                    value={`${formatNumber(result.fishesNeeded)} peixes`}
                    description="Para sustentar sua mana durante o treino"
                  />

                  <ResultCard
                    icon={<Coins className="w-6 h-6" />}
                    title="Alternativa: Mana Fluids"
                    value={`${formatNumber(result.manaFluids)} mana fluids`}
                    description={`Custo total: ${formatNumber(result.manaFluidsCost)} gps`}
                  />
                </div>

                <div className="bg-maroon/5 border border-maroon/20 rounded p-4 text-sm">
                  <p>
                    <strong>Resumo:</strong> Você precisará gastar aproximadamente{" "}
                    <strong className="text-maroon">{formatNumber(result.manaNeeded)}</strong> de mana para atingir
                    Magic Level <strong className="text-maroon">{desiredML}</strong>. Isso levará aproximadamente{" "}
                    <strong className="text-maroon">{formatTime(result.trainingTime)}</strong>.
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
