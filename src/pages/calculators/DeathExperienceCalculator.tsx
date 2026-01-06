import MainLayout from '@/layouts/MainLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useMemo } from 'react';
import { Skull, Heart } from 'lucide-react';
import { 
  blessings, 
  getLevelFromExperience, 
  getLevelProgress, 
  calculateDeathExperience 
} from '@/data/calculators/deathExperience';

const formatNumber = (num: number): string => {
  return num.toLocaleString('pt-BR');
};

interface ProgressBarProps {
  percentage: number;
  variant: 'before' | 'after';
}

const ProgressBar = ({ percentage, variant }: ProgressBarProps) => (
  <div className="w-full h-3 bg-muted rounded overflow-hidden border border-border">
    <div 
      className={`h-full transition-all duration-300 ${
        variant === 'before' ? 'bg-emerald-500' : 'bg-red-500'
      }`}
      style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
    />
  </div>
);

interface StatBoxProps {
  title: string;
  icon: React.ReactNode;
  experience: number;
  level: number;
  progress: number;
  variant: 'before' | 'after';
  loss?: number;
}

const StatBox = ({ title, icon, experience, level, progress, variant, loss }: StatBoxProps) => (
  <div className="bg-cream border border-border-light rounded p-4">
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      {icon}
      <h3 className="font-semibold text-maroon text-sm uppercase">{title}</h3>
    </div>
    
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Experiência</span>
        <span className="font-semibold text-text-dark">{formatNumber(experience)}</span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Level</span>
        <span className="font-bold text-lg text-maroon">{level}</span>
      </div>
      
      <div className="space-y-1">
        <ProgressBar percentage={progress} variant={variant} />
        <p className="text-xs text-center text-muted-foreground">
          {progress.toFixed(0)}% do level
        </p>
      </div>
      
      {loss !== undefined && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-red-600">Perda Total</span>
            <span className="font-bold text-red-600">-{formatNumber(loss)} exp</span>
          </div>
        </div>
      )}
    </div>
  </div>
);

const DeathExperienceCalculator = () => {
  const [experience, setExperience] = useState<number>(15694800);
  const [activeBlessings, setActiveBlessings] = useState<string[]>([]);

  const handleExperienceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setExperience(isNaN(value) ? 0 : value);
  };

  const toggleBlessing = (blessingId: string) => {
    setActiveBlessings(prev => 
      prev.includes(blessingId) 
        ? prev.filter(id => id !== blessingId)
        : [...prev, blessingId]
    );
  };

  const results = useMemo(() => {
    const deathResult = calculateDeathExperience(experience, activeBlessings);
    const levelBefore = getLevelFromExperience(experience);
    const levelAfter = getLevelFromExperience(deathResult.afterDeath);
    const progressBefore = getLevelProgress(experience);
    const progressAfter = getLevelProgress(deathResult.afterDeath);
    
    return {
      ...deathResult,
      levelBefore,
      levelAfter,
      progressBefore,
      progressAfter,
    };
  }, [experience, activeBlessings]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Calculadora de XP na Morte</h2>
          </header>
          <div className="news-box-content space-y-6">
            <p className="text-sm">
              Calcule quanto de experiência você perderá ao morrer. Marque suas blessings e promoção para ver a redução na perda.
            </p>

            {/* Input de Experiência */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Label htmlFor="experience" className="text-text-dark font-semibold whitespace-nowrap">
                Experiência Atual:
              </Label>
              <Input
                id="experience"
                type="number"
                value={experience}
                onChange={handleExperienceChange}
                className="w-full sm:w-48 bg-secondary text-text-dark border-border"
                placeholder="Digite sua experiência"
              />
            </div>

            {/* Blessings */}
            <div className="bg-cream border border-border-light rounded p-4">
              <h3 className="font-semibold text-maroon mb-3 text-sm uppercase">
                Promoção e Blessings
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Marque as blessings e promoção que você possui:
              </p>
              <div className="space-y-2">
                {blessings.map((blessing) => (
                  <div key={blessing.id} className="flex items-center gap-3">
                    <Checkbox
                      id={blessing.id}
                      checked={activeBlessings.includes(blessing.id)}
                      onCheckedChange={() => toggleBlessing(blessing.id)}
                    />
                    <Label 
                      htmlFor={blessing.id} 
                      className="text-sm cursor-pointer flex items-center gap-2"
                    >
                      {blessing.location && (
                        <span className="text-xs font-semibold text-maroon">
                          [{blessing.location}]
                        </span>
                      )}
                      <span>{blessing.name}</span>
                      <span className="text-xs text-emerald-600 font-semibold">
                        (+{(blessing.bonus * 100).toFixed(0)}%)
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Retenção total: <span className="font-semibold text-maroon">
                  {(results.retentionPercentage * 100).toFixed(0)}%
                </span> (perda de {((1 - results.retentionPercentage) * 100).toFixed(0)}%)
              </p>
            </div>

            {/* Resultados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatBox
                title="Antes da Morte"
                icon={<Heart className="w-5 h-5 text-emerald-500" />}
                experience={experience}
                level={results.levelBefore}
                progress={results.progressBefore}
                variant="before"
              />
              <StatBox
                title="Após a Morte"
                icon={<Skull className="w-5 h-5 text-red-500" />}
                experience={results.afterDeath}
                level={results.levelAfter}
                progress={results.progressAfter}
                variant="after"
                loss={results.loss}
              />
            </div>

            {results.levelBefore !== results.levelAfter && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
                <p className="text-sm text-red-700 font-semibold">
                  ⚠️ Atenção: Você perderá {results.levelBefore - results.levelAfter} level(s) ao morrer!
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default DeathExperienceCalculator;
