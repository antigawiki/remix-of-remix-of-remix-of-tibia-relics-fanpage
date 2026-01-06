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

// Componente para card de status
const StatusCard = ({
  title,
  level,
  experience,
  icon,
  variant = "default",
}: {
  title: string;
  level: number;
  experience: number;
  icon: React.ReactNode;
  variant?: "default" | "target";
}) => (
  <div className="news-box">
    <div className="news-box-header flex items-center gap-2">
      {icon}
      <span>{title}</span>
    </div>
    <div className="news-box-content p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground text-sm">Level:</span>
        <span className={`text-2xl font-bold ${variant === "target" ? "text-primary" : ""}`}>
          {level}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground text-sm">Experiência:</span>
        <span className="font-mono text-sm">{experience.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  </div>
);

// Componente para card de monstro
const MonsterCard = ({
  monster,
  count,
}: {
  monster: MonsterData;
  count: number;
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
        <div className="text-xs text-muted-foreground">{monster.experience} XP cada</div>
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-lg">{count.toLocaleString("pt-BR")}</div>
      <div className="text-xs text-muted-foreground">monstros</div>
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
          <div className="news-box-header">Calculadora de Experiência</div>
          <div className="news-box-content p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Calcule quantos monstros você precisa matar para atingir o level desejado.
            </p>

            {/* Inputs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currentExp" className="text-text-dark font-semibold">Experiência Atual:</Label>
                <Input
                  id="currentExp"
                  type="number"
                  value={currentExp}
                  onChange={handleExpChange}
                  placeholder="exemplo: 1893256"
                  min={0}
                  className="bg-secondary text-text-dark border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetLevel" className="text-text-dark font-semibold">Level Desejado:</Label>
                <Input
                  id="targetLevel"
                  type="number"
                  value={targetLevel}
                  onChange={handleLevelChange}
                  placeholder="exemplo: 100"
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
                title="Seu Status Atual"
                level={result.currentLevel}
                experience={currentExp}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatusCard
                title="Objetivo"
                level={targetLevel}
                experience={result.targetExp}
                icon={<Target className="w-4 h-4" />}
                variant="target"
              />
            </div>

            {/* Progress */}
            <div className="news-box">
              <div className="news-box-content p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso para o Level {result.currentLevel + 1}</span>
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
                <span>{result.alreadyReached ? "Parabéns!" : "Experiência Necessária"}</span>
              </div>
              <div className="news-box-content p-4">
                {result.alreadyReached ? (
                  <p className="text-green-600 font-medium">
                    Você já atingiu o level desejado!
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-lg">
                      <span className="text-muted-foreground">Faltam:</span>{" "}
                      <span className="font-bold text-destructive">
                        {result.neededExp.toLocaleString("pt-BR")} XP
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      para atingir o level {targetLevel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Monster Cards */}
            {!result.alreadyReached && (
              <div className="news-box">
                <div className="news-box-header">Monstros Necessários</div>
                <div className="news-box-content p-4 space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Você pode atingir o level {targetLevel} derrotando aproximadamente:
                  </p>
                  <div className="space-y-2">
                    {result.monstersNeeded.map(({ monster, count }) => (
                      <MonsterCard
                        key={monster.id}
                        monster={monster}
                        count={count}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 italic">
                    As sugestões acima são ilustrativas e não obrigatórias.
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
