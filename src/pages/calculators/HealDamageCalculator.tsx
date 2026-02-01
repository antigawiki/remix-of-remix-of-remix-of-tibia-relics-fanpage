import { useState, useMemo } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { spellDamageData, calculateSpellDamage, SpellDamageData } from '@/data/calculators/spellDamage';
import { useTranslation } from '@/i18n';

interface SpellCardProps {
  spell: SpellDamageData;
  level: number;
  magicLevel: number;
  t: (key: string) => string;
}

const SpellCard = ({ spell, level, magicLevel, t }: SpellCardProps) => {
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
          <div className="text-muted-foreground mb-1">{t('calculatorPages.healDamage.baseMin')}</div>
          <div className="bg-secondary/50 rounded px-2 py-1 text-text-dark font-medium">{spell.baseMin}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">{t('calculatorPages.healDamage.baseMax')}</div>
          <div className="bg-secondary/50 rounded px-2 py-1 text-text-dark font-medium">{spell.baseMax}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">{t('calculatorPages.healDamage.min')}</div>
          <div className="bg-primary/20 rounded px-2 py-1 text-text-dark font-bold">{result.min}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">{t('calculatorPages.healDamage.max')}</div>
          <div className="bg-primary/20 rounded px-2 py-1 text-text-dark font-bold">{result.max}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">{t('calculatorPages.healDamage.avg')}</div>
          <div className="bg-accent/30 rounded px-2 py-1 text-text-dark font-bold">{result.avg}</div>
        </div>
      </div>
    </div>
  );
};

const HealDamageCalculator = () => {
  const { t } = useTranslation();
  const [level, setLevel] = useState<number>(100);
  const [magicLevel, setMagicLevel] = useState<number>(50);

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setLevel(isNaN(value) ? 0 : value);
  };

  const handleMagicLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setMagicLevel(isNaN(value) ? 0 : value);
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
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('calculatorPages.healDamage.title')}
            </h2>
          </header>
          <div className="news-box-content">
            <p className="text-sm mb-4">
              {t('calculatorPages.healDamage.description')}
            </p>
            
            {/* Input Controls */}
            <div className="flex flex-wrap gap-4 mb-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="level" className="text-text-dark font-semibold whitespace-nowrap">{t('calculatorPages.healDamage.level')}:</Label>
                <Input
                  id="level"
                  type="number"
                  value={level}
                  onChange={handleLevelChange}
                  className="w-24 bg-secondary text-text-dark border-border"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="mlvl" className="text-text-dark font-semibold whitespace-nowrap">{t('calculatorPages.healDamage.magicLevel')}:</Label>
                <Input
                  id="mlvl"
                  type="number"
                  value={magicLevel}
                  onChange={handleMagicLevelChange}
                  className="w-24 bg-secondary text-text-dark border-border"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Healing Spells */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">{t('calculatorPages.healDamage.healingSpells')}</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {healingSpells.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} t={t} />
              ))}
            </div>
          </div>
        </section>

        {/* Healing Runes */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">{t('calculatorPages.healDamage.healingRunes')}</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {healingRunes.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} t={t} />
              ))}
            </div>
          </div>
        </section>

        {/* Attack Runes */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">{t('calculatorPages.healDamage.attackRunes')}</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {attackRunes.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} t={t} />
              ))}
            </div>
          </div>
        </section>

        {/* Attack Spells */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">{t('calculatorPages.healDamage.attackSpells')}</h2>
          </header>
          <div className="news-box-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {attackSpells.map(spell => (
                <SpellCard key={spell.id} spell={spell} level={level} magicLevel={magicLevel} t={t} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default HealDamageCalculator;
