import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Sword, Target, Shield } from 'lucide-react';
import {
  skillVocations,
  SkillVocationData,
  SkillsCalculationResult,
  calculateSkills,
  formatTime,
} from '@/data/calculators/skills';
import { useTranslation } from '@/i18n';

const SkillsCalculator = () => {
  const { t } = useTranslation();
  const [selectedVocation, setSelectedVocation] = useState<SkillVocationData | null>(null);
  
  const [meleeEnabled, setMeleeEnabled] = useState(false);
  const [distanceEnabled, setDistanceEnabled] = useState(false);
  const [shieldEnabled, setShieldEnabled] = useState(false);
  
  const [meleeCurrentSkill, setMeleeCurrentSkill] = useState('');
  const [meleeDesiredSkill, setMeleeDesiredSkill] = useState('');
  const [meleePercent, setMeleePercent] = useState('');
  const [distanceCurrentSkill, setDistanceCurrentSkill] = useState('');
  const [distanceDesiredSkill, setDistanceDesiredSkill] = useState('');
  const [distancePercent, setDistancePercent] = useState('');
  const [shieldCurrentSkill, setShieldCurrentSkill] = useState('');
  const [shieldDesiredSkill, setShieldDesiredSkill] = useState('');
  const [shieldPercent, setShieldPercent] = useState('');
  
  const [result, setResult] = useState<SkillsCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeLabels = {
    days: t('calculatorPages.magicLevel.days'),
    hours: t('calculatorPages.magicLevel.hours'),
    minutes: t('calculatorPages.magicLevel.minutes'),
    seconds: t('calculatorPages.magicLevel.seconds'),
  };

  const resetInputs = () => {
    setMeleeEnabled(false);
    setDistanceEnabled(false);
    setShieldEnabled(false);
    setMeleeCurrentSkill('');
    setMeleeDesiredSkill('');
    setMeleePercent('');
    setDistanceCurrentSkill('');
    setDistanceDesiredSkill('');
    setDistancePercent('');
    setShieldCurrentSkill('');
    setShieldDesiredSkill('');
    setShieldPercent('');
    setResult(null);
    setError(null);
  };

  const handleVocationSelect = (vocation: SkillVocationData) => {
    setSelectedVocation(vocation);
    resetInputs();
  };

  const validateSkill = (current: number, desired: number, skillName: string): string | null => {
    if (current < 10 || desired < 10) {
      return t('calculatorPages.skills.minValueError').replace('{skill}', skillName);
    }
    if (current >= desired) {
      return t('calculatorPages.skills.desiredMustBeGreater').replace('{skill}', skillName);
    }
    return null;
  };

  const handleCalculate = () => {
    if (!selectedVocation) {
      setError(t('calculatorPages.skills.selectVocation'));
      return;
    }

    if (!meleeEnabled && !distanceEnabled && !shieldEnabled) {
      setError(t('calculatorPages.skills.selectAtLeastOne'));
      return;
    }

    const skills: {
      melee?: { current: number; desired: number; percentage?: number };
      distance?: { current: number; desired: number; percentage?: number };
      shield?: { current: number; desired: number; percentage?: number };
    } = {};

    if (meleeEnabled) {
      const current = parseInt(meleeCurrentSkill);
      const desired = parseInt(meleeDesiredSkill);
      const pct = meleePercent ? parseInt(meleePercent) : 0;
      
      if (isNaN(current) || isNaN(desired)) {
        setError(t('calculatorPages.skills.fillFieldsCorrectly').replace('{skill}', 'Melee'));
        return;
      }
      
      const validationError = validateSkill(current, desired, 'Melee');
      if (validationError) {
        setError(validationError);
        return;
      }
      
      skills.melee = { current, desired, percentage: pct };
    }

    if (distanceEnabled) {
      const current = parseInt(distanceCurrentSkill);
      const desired = parseInt(distanceDesiredSkill);
      const pct = distancePercent ? parseInt(distancePercent) : 0;
      
      if (isNaN(current) || isNaN(desired)) {
        setError(t('calculatorPages.skills.fillFieldsCorrectly').replace('{skill}', 'Distance'));
        return;
      }
      
      const validationError = validateSkill(current, desired, 'Distance');
      if (validationError) {
        setError(validationError);
        return;
      }
      
      skills.distance = { current, desired, percentage: pct };
    }

    if (shieldEnabled) {
      const current = parseInt(shieldCurrentSkill);
      const desired = parseInt(shieldDesiredSkill);
      const pct = shieldPercent ? parseInt(shieldPercent) : 0;
      
      if (isNaN(current) || isNaN(desired)) {
        setError(t('calculatorPages.skills.fillFieldsCorrectly').replace('{skill}', 'Shield'));
        return;
      }
      
      const validationError = validateSkill(current, desired, 'Shield');
      if (validationError) {
        setError(validationError);
        return;
      }
      
      skills.shield = { current, desired, percentage: pct };
    }

    setError(null);
    const calculationResult = calculateSkills(selectedVocation, skills);
    setResult(calculationResult);
  };

  const getSkillIcon = (skillType: 'melee' | 'distance' | 'shield') => {
    switch (skillType) {
      case 'melee':
        return <Sword className="w-6 h-6 text-maroon" />;
      case 'distance':
        return <Target className="w-6 h-6 text-maroon" />;
      case 'shield':
        return <Shield className="w-6 h-6 text-maroon" />;
    }
  };

  const getSkillName = (skillType: 'melee' | 'distance' | 'shield') => {
    switch (skillType) {
      case 'melee':
        return 'Melee';
      case 'distance':
        return 'Distance';
      case 'shield':
        return 'Shielding';
    }
  };

  const renderSkillInputs = (
    skillName: string,
    icon: React.ReactNode,
    enabled: boolean,
    setEnabled: (v: boolean) => void,
    currentSkill: string,
    setCurrentSkill: (v: string) => void,
    desiredSkill: string,
    setDesiredSkill: (v: string) => void,
    percent: string,
    setPercent: (v: string) => void,
    id: string,
  ) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked === true);
            if (!checked) {
              setCurrentSkill('');
              setDesiredSkill('');
              setPercent('');
            }
            setResult(null);
          }}
        />
        <label htmlFor={id} className="text-sm font-medium cursor-pointer flex items-center gap-2">
          {icon} {skillName}
        </label>
      </div>
      {enabled && (
        <div className="grid grid-cols-3 gap-3 ml-6">
          <div className="space-y-1">
            <label className="text-xs">{t('calculatorPages.skills.currentSkill')}:</label>
            <Input
              type="number"
              value={currentSkill}
              onChange={(e) => { setCurrentSkill(e.target.value); setResult(null); }}
              placeholder="Ex: 10"
              min={10}
              className="bg-secondary text-text-dark border-border"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs">{t('calculatorPages.skills.percentToNext')}:</label>
            <Input
              type="number"
              value={percent}
              onChange={(e) => {
                const val = Math.max(0, Math.min(99, parseInt(e.target.value) || 0));
                setPercent(e.target.value === '' ? '' : String(val));
                setResult(null);
              }}
              placeholder="0"
              min={0}
              max={99}
              className="bg-secondary text-text-dark border-border"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs">{t('calculatorPages.skills.desiredSkill')}:</label>
            <Input
              type="number"
              value={desiredSkill}
              onChange={(e) => { setDesiredSkill(e.target.value); setResult(null); }}
              placeholder="Ex: 50"
              min={10}
              className="bg-secondary text-text-dark border-border"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold flex items-center gap-2">
              <Target className="w-5 h-5" />
              {t('calculatorPages.skills.title')}
            </h2>
          </header>
          <div className="news-box-content space-y-6">
            <p className="text-sm mb-4">
              {t('calculatorPages.skills.description')}
            </p>

            {/* Seleção de Vocação */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">{t('calculatorPages.skills.chooseVocation')}:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {skillVocations.map((vocation) => (
                  <button
                    key={vocation.id}
                    onClick={() => handleVocationSelect(vocation)}
                    className={`p-3 rounded border-2 text-center transition-all ${
                      selectedVocation?.id === vocation.id
                        ? 'border-maroon bg-maroon/10 text-maroon'
                        : 'border-border-light bg-cream hover:border-maroon/50'
                    }`}
                  >
                    <span className="text-sm font-medium">{vocation.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Skills */}
            {selectedVocation && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('calculatorPages.skills.selectSkills')}:</h3>
                
                {renderSkillInputs('Melee', <Sword className="w-4 h-4" />, meleeEnabled, setMeleeEnabled, meleeCurrentSkill, setMeleeCurrentSkill, meleeDesiredSkill, setMeleeDesiredSkill, meleePercent, setMeleePercent, 'melee')}
                {renderSkillInputs('Distance', <Target className="w-4 h-4" />, distanceEnabled, setDistanceEnabled, distanceCurrentSkill, setDistanceCurrentSkill, distanceDesiredSkill, setDistanceDesiredSkill, distancePercent, setDistancePercent, 'distance')}
                {renderSkillInputs('Shield', <Shield className="w-4 h-4" />, shieldEnabled, setShieldEnabled, shieldCurrentSkill, setShieldCurrentSkill, shieldDesiredSkill, setShieldDesiredSkill, shieldPercent, setShieldPercent, 'shield')}
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}

            {/* Botão Calcular */}
            {selectedVocation && (
              <Button onClick={handleCalculate} className="w-full">
                {t('calculatorPages.skills.calculate')}
              </Button>
            )}

            {/* Resultados */}
            {result && result.results.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b border-border-light pb-2">
                  {t('calculatorPages.skills.resultsFor')} {result.vocation.name}
                </h3>
                <div className="space-y-3">
                  {result.results.map((skillResult) => (
                    <div
                      key={skillResult.skillType}
                      className="bg-cream border border-border-light rounded p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getSkillIcon(skillResult.skillType)}
                        <span className="font-medium text-sm">
                          {getSkillName(skillResult.skillType)}
                        </span>
                      </div>
                      <p className="text-sm">
                        {t('calculatorPages.skills.estimatedTime')}{' '}
                        <strong>{skillResult.currentSkill}</strong> {t('calculatorPages.skills.to')}{' '}
                        <strong>{skillResult.desiredSkill}</strong>:
                      </p>
                      <p className="text-maroon font-semibold mt-1">
                        {formatTime(skillResult.time, timeLabels)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default SkillsCalculator;
