import React, { useState, useMemo } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skull, Eye, Flame, Target, TrendingUp, Trophy } from "lucide-react";
import {
  calculateExperienceDifference,
  getLevelProgress,
  referenceMonsters,
} from "@/data/calculators/experienceLevel";

// Ícones para cada monstro
const monsterIcons: Record<string, React.ReactNode> = {
  ghoul: <Skull className="w-5 h-5" />,
  cyclops: <Eye className="w-5 h-5" />,
  bonebeast: <Skull className="w-5 h-5" />,
  dragon: <Flame className="w-5 h-5" />,
  dragonlord: <Flame className="w-5 h-5 text-red-500" />,
};

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
        <span className="text-muted-foreground text-sm">Experience:</span>
        <span className="font-mono text-sm">{experience.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  </div>
);

// Componente para card de monstro
const MonsterCard = ({
  name,
  experience,
  count,
  icon,
}: {
  name: string;
  experience: number;
  count: number;
  icon: React.ReactNode;
}) => (
  <div className="flex items-center justify-between p-3 bg-background/50 rounded border border-border/50">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded bg-muted">{icon}</div>
      <div>
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-muted-foreground">{experience} XP each</div>
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-lg">{count.toLocaleString("pt-BR")}</div>
      <div className="text-xs text-muted-foreground">monsters</div>
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
          <div className="news-box-header">Experience Calculator</div>
          <div className="news-box-content p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Calculate how many monsters you need to kill to reach your desired level.
            </p>

            {/* Inputs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currentExp">Current Experience:</Label>
                <Input
                  id="currentExp"
                  type="number"
                  value={currentExp}
                  onChange={handleExpChange}
                  placeholder="example: 1893256"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetLevel">Desired Level:</Label>
                <Input
                  id="targetLevel"
                  type="number"
                  value={targetLevel}
                  onChange={handleLevelChange}
                  placeholder="example: 100"
                  min={1}
                  max={300}
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
                title="Your Current Status"
                level={result.currentLevel}
                experience={currentExp}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatusCard
                title="Target"
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
                  <span>Progress to Level {result.currentLevel + 1}</span>
                  <span>{currentProgress.toFixed(1)}%</span>
                </div>
                <ProgressBar progress={currentProgress} />
              </div>
            </div>

            {/* Result Banner */}
            <div className={`news-box ${result.alreadyReached ? "" : ""}`}>
              <div className="news-box-header flex items-center gap-2">
                {result.alreadyReached ? (
                  <Trophy className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
                <span>{result.alreadyReached ? "Congratulations!" : "Experience Needed"}</span>
              </div>
              <div className="news-box-content p-4">
                {result.alreadyReached ? (
                  <p className="text-green-600 font-medium">
                    You have already reached the desired level!
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-lg">
                      <span className="text-muted-foreground">Missing:</span>{" "}
                      <span className="font-bold text-destructive">
                        {result.neededExp.toLocaleString("pt-BR")} XP
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      to reach level {targetLevel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Monster Cards */}
            {!result.alreadyReached && (
              <div className="news-box">
                <div className="news-box-header">Monsters Needed</div>
                <div className="news-box-content p-4 space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    You can reach level {targetLevel} by defeating approximately:
                  </p>
                  <div className="space-y-2">
                    {result.monstersNeeded.map(({ monster, count }) => (
                      <MonsterCard
                        key={monster.id}
                        name={monster.name}
                        experience={monster.experience}
                        count={count}
                        icon={monsterIcons[monster.id] || <Skull className="w-5 h-5" />}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 italic">
                    The suggestions above are illustrative and not mandatory.
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
