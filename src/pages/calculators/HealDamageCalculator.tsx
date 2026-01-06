import { useState, useMemo } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { spellDamageData, calculateSpellDamage, SpellDamageData } from '@/data/calculators/spellDamage';

interface SpellCardProps {
  spell: SpellDamageData;
  level: number;
  magicLevel: number;
}

const SpellCard = ({ spell, level, magicLevel }: SpellCardProps) => {
  const result = useMemo(() => {
    return calculateSpellDamage(level, magicLevel, spell.baseMin, spell.baseMax);
  }, [level, magicLevel, spell.baseMin, spell.baseMax]);

  return (
    <div className="parchment p-3 rounded-sm">
      <div className="flex items-center gap-3 mb-3">
        <img 
          src={spell.image} 
          alt={spell.name} 
          className="w-8 h-8 object-contain"
          onError={(e) => {
            e.currentTarget.src = 'https://tibiara.netlify.app/en/img/runes/exura.gif';
          }}
        />
        <div>
          <h4 className="font-heading font-semibold text-text-dark text-sm">{spell.name}</h4>
          <p className="text-xs text-muted-foreground">{spell.words}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Base Min</div>
          <div className="bg-secondary/50 rounded px-2 py-1 text-text-dark font-medium">{spell.baseMin}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Base Max</div>
          <div className="bg-secondary/50 rounded px-2 py-1 text-text-dark font-medium">{spell.baseMax}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Min</div>
          <div className="bg-primary/20 rounded px-2 py-1 text-text-dark font-bold">{result.min}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Max</div>
          <div className="bg-primary/20 rounded px-2 py-1 text-text-dark font-bold">{result.max}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Avg</div>
          <div className="bg-accent/30 rounded px-2 py-1 text-text-dark font-bold">{result.avg}</div>
        </div>
      </div>
    </div>
  );
};

const HealDamageCalculator = () => {
  const [level, setLevel] = useState<number>(100);
  const [magicLevel, setMagicLevel] = useState<number>(50);

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setLevel(Math.max(0, value));
  };

  const handleMagicLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setMagicLevel(Math.max(0, value));
  };

  const healingSpells = spellDamageData.filter(s => s.type === 'heal' && s.category === 'spell');
  const healingRunes = spellDamageData.filter(s => s.type === 'heal' && s.category === 'rune');
  const attackRunes = spellDamageData.filter(s => s.type === 'attack' && s.category === 'rune');
  const attackSpells = spellDamageData.filter(s => s.type === 'attack' && s.category === 'spell');

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <section className="news-box">
          <header className="news-box-header">
            <h1 className="text-lg font-bold">Calculadora de Heal / Dano com Magias</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm mb-4">
              Calcule o heal e dano de magias e runas baseado no seu Level e Magic Level.
            </p>
            
            {/* Input Controls */}
            <div className="flex flex-wrap gap-4 mb-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="level" className="text-text-dark font-semibold whitespace-nowrap">Level:</Label>
                <Input
                  id="level"
                  type="number"
                  value={level}
                  onChange={handleLevelChange}
                  className="w-24 bg-secondary text-text-dark border-border"
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="mlvl" className="text-text-dark font-semibold whitespace-nowrap">Magic Level:</Label>
                <Input
                  id="mlvl"
                  type="number"
                  value={magicLevel}
                  onChange={handleMagicLevelChange}
                  className="w-24 bg-secondary text-text-dark border-border"
                  min={0}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Fórmula: (Magic Level × 3 + Level × 2) / 100
            </p>
          </div>
        </section>

        {/* Healing Spells */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Magias de Cura</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {healingSpells.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} />
              ))}
            </div>
          </div>
        </section>

        {/* Healing Runes */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Runas de Cura</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {healingRunes.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} />
              ))}
            </div>
          </div>
        </section>

        {/* Attack Runes */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Runas de Ataque</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {attackRunes.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} />
              ))}
            </div>
          </div>
        </section>

        {/* Attack Spells */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Magias de Ataque</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {attackSpells.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default HealDamageCalculator;
