import React, { useState, useMemo } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, TrendingUp, Trophy } from "lucide-react";
import {
  calculateExperienceDifference,
  getLevelProgress,
  MonsterData,
} from "@/data/calculators/experienceLevel";
import { useTranslation } from "@/i18n";

// Componente para card de status
const StatusCard = ({
  title,
  level,
  experience,
  icon,
  variant = "default",
  t,
}: {
  title: string;
  level: number;
  experience: number;
  icon: React.ReactNode;
  variant?: "default" | "target";
  t: (key: string) => string;
}) => (
  <div className="news-box">
    <div className="news-box-header flex items-center gap-2">
      {icon}
      <span>{title}</span>
    </div>
    <div className="news-box-content p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground text-sm">{t('calculatorPages.experienceLevel.levelLabel')}:</span>
        <span className={`text-2xl font-bold ${variant === "target" ? "text-primary" : ""}`}>
          {level}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground text-sm">{t('calculatorPages.experienceLevel.experience')}:</span>
        <span className="font-mono text-sm">{experience.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  </div>
);

// Componente para card de monstro
const MonsterCard = ({
  monster,
  count,
  t,
}: {
  monster: MonsterData;
  count: number;
  t: (key: string) => string;
}) => (
  <div className="flex items-center justify-between p-3 bg-background/50 rounded border border-border/50">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 flex items-center justify-center">
        <img 
          src={monster.image} 
          alt={monster.name} 
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <div>
        <div className="font-medium text-sm">{monster.name}</div>
        <div className="text-xs text-muted-foreground">{monster.experience} XP {t('calculatorPages.experienceLevel.each')}</div>
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-lg">{count.toLocaleString("pt-BR")}</div>
      <div className="text-xs text-muted-foreground">{t('calculatorPages.experienceLevel.monsters')}</div>
    </div>
  </div>
);

// Barra de progresso
const ProgressBar = ({ progress, variant = "default" }: { progress: number; variant?: "default" | "success" }) => (
  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
    <div
      className={`h-full transition-all duration-300 ${
        variant === "success" ? "bg-green-500" : "bg-primary"
      }`}
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);

const ExperienceLevelCalculator = () => {
  const { t } = useTranslation();
  const [currentExp, setCurrentExp] = useState<number>(1328800);
  const [targetLevel, setTargetLevel] = useState<number>(100);

  // Calcular resultados
  const result = useMemo(() => {
    if (currentExp < 0 || targetLevel < 1) {
      return null;
    }
    return calculateExperienceDifference(currentExp, targetLevel);
  }, [currentExp, targetLevel]);

  const currentProgress = useMemo(() => {
    return getLevelProgress(currentExp);
  }, [currentExp]);

  const handleExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setCurrentExp(Math.max(0, value));
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    setTargetLevel(Math.max(1, Math.min(300, value)));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="news-box">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('calculatorPages.experienceLevel.title')}
          </h2>
        </header>
          <div className="news-box-content p-4">
            <p className="text-sm mb-4">
              {t('calculatorPages.experienceLevel.description')}
            </p>

            {/* Inputs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currentExp" className="text-text-dark font-semibold">{t('calculatorPages.experienceLevel.currentExperience')}:</Label>
                <Input
                  id="currentExp"
                  type="number"
                  value={currentExp}
                  onChange={handleExpChange}
                  placeholder={t('calculatorPages.experienceLevel.exampleExp')}
                  min={0}
                  className="bg-secondary text-text-dark border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetLevel" className="text-text-dark font-semibold">{t('calculatorPages.experienceLevel.desiredLevel')}:</Label>
                <Input
                  id="targetLevel"
                  type="number"
                  value={targetLevel}
                  onChange={handleLevelChange}
                  placeholder={t('calculatorPages.experienceLevel.exampleLevel')}
                  min={1}
                  max={300}
                  className="bg-secondary text-text-dark border-border"
                />
              </div>
            </div>
          </div>
        </div>

        {result && (
          <>
            {/* Status Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              <StatusCard
                title={t('calculatorPages.experienceLevel.currentStatus')}
                level={result.currentLevel}
                experience={currentExp}
                icon={<TrendingUp className="w-4 h-4" />}
                t={t}
              />
              <StatusCard
                title={t('calculatorPages.experienceLevel.goal')}
                level={targetLevel}
                experience={result.targetExp}
                icon={<Target className="w-4 h-4" />}
                variant="target"
                t={t}
              />
            </div>

            {/* Progress */}
            <div className="news-box">
              <div className="news-box-content p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('calculatorPages.experienceLevel.progressTo')} {result.currentLevel + 1}</span>
                  <span>{currentProgress.toFixed(1)}%</span>
                </div>
                <ProgressBar progress={currentProgress} />
              </div>
            </div>

            {/* Result Banner */}
            <div className="news-box">
              <div className="news-box-header flex items-center gap-2">
                {result.alreadyReached ? (
                  <Trophy className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
                <span>{result.alreadyReached ? t('calculatorPages.experienceLevel.congratulations') : t('calculatorPages.experienceLevel.neededExperience')}</span>
              </div>
              <div className="news-box-content p-4">
                {result.alreadyReached ? (
                  <p className="text-green-600 font-medium">
                    {t('calculatorPages.experienceLevel.alreadyReached')}
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-lg">
                      <span className="text-muted-foreground">{t('calculatorPages.experienceLevel.remaining')}:</span>{" "}
                      <span className="font-bold text-destructive">
                        {result.neededExp.toLocaleString("pt-BR")} XP
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('calculatorPages.experienceLevel.toReachLevel')} {targetLevel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Monster Cards */}
            {!result.alreadyReached && (
              <div className="news-box">
                <div className="news-box-header">{t('calculatorPages.experienceLevel.monstersNeeded')}</div>
                <div className="news-box-content p-4 space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('calculatorPages.experienceLevel.canReachBy').replace('{level}', String(targetLevel))}
                  </p>
                  <div className="space-y-2">
                    {result.monstersNeeded.map(({ monster, count }) => (
                      <MonsterCard
                        key={monster.id}
                        monster={monster}
                        count={count}
                        t={t}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 italic">
                    {t('calculatorPages.experienceLevel.illustrative')}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default ExperienceLevelCalculator;
