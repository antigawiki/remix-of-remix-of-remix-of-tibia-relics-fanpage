import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Sword, Target, Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  skillVocations,
  SkillVocationData,
  SkillsCalculationResult,
  calculateSkills,
  formatTime,
} from '@/data/calculators/skills';

const SkillsCalculator = () => {
  const [selectedVocation, setSelectedVocation] = useState<SkillVocationData | null>(null);
  
  // Checkboxes
  const [meleeEnabled, setMeleeEnabled] = useState(false);
  const [distanceEnabled, setDistanceEnabled] = useState(false);
  const [shieldEnabled, setShieldEnabled] = useState(false);
  
  // Inputs
  const [meleeCurrentSkill, setMeleeCurrentSkill] = useState('');
  const [meleeDesiredSkill, setMeleeDesiredSkill] = useState('');
  const [distanceCurrentSkill, setDistanceCurrentSkill] = useState('');
  const [distanceDesiredSkill, setDistanceDesiredSkill] = useState('');
  const [shieldCurrentSkill, setShieldCurrentSkill] = useState('');
  const [shieldDesiredSkill, setShieldDesiredSkill] = useState('');
  
  const [result, setResult] = useState<SkillsCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetInputs = () => {
    setMeleeEnabled(false);
    setDistanceEnabled(false);
    setShieldEnabled(false);
    setMeleeCurrentSkill('');
    setMeleeDesiredSkill('');
    setDistanceCurrentSkill('');
    setDistanceDesiredSkill('');
    setShieldCurrentSkill('');
    setShieldDesiredSkill('');
    setResult(null);
    setError(null);
  };

  const handleVocationSelect = (vocation: SkillVocationData) => {
    setSelectedVocation(vocation);
    resetInputs();
  };

  const validateSkill = (current: number, desired: number, skillName: string): string | null => {
    if (current < 10 || desired < 10) {
      return `Valores menores que 10 não são aceitos para ${skillName}.`;
    }
    if (current >= desired) {
      return `A skill ${skillName} desejada deve ser maior que a atual.`;
    }
    return null;
  };

  const handleCalculate = () => {
    if (!selectedVocation) {
      setError('Selecione uma vocação.');
      return;
    }

    if (!meleeEnabled && !distanceEnabled && !shieldEnabled) {
      setError('Selecione pelo menos uma skill para calcular.');
      return;
    }

    const skills: {
      melee?: { current: number; desired: number };
      distance?: { current: number; desired: number };
      shield?: { current: number; desired: number };
    } = {};

    if (meleeEnabled) {
      const current = parseInt(meleeCurrentSkill);
      const desired = parseInt(meleeDesiredSkill);
      
      if (isNaN(current) || isNaN(desired)) {
        setError('Preencha os campos de Melee corretamente.');
        return;
      }
      
      const validationError = validateSkill(current, desired, 'Melee');
      if (validationError) {
        setError(validationError);
        return;
      }
      
      skills.melee = { current, desired };
    }

    if (distanceEnabled) {
      const current = parseInt(distanceCurrentSkill);
      const desired = parseInt(distanceDesiredSkill);
      
      if (isNaN(current) || isNaN(desired)) {
        setError('Preencha os campos de Distance corretamente.');
        return;
      }
      
      const validationError = validateSkill(current, desired, 'Distance');
      if (validationError) {
        setError(validationError);
        return;
      }
      
      skills.distance = { current, desired };
    }

    if (shieldEnabled) {
      const current = parseInt(shieldCurrentSkill);
      const desired = parseInt(shieldDesiredSkill);
      
      if (isNaN(current) || isNaN(desired)) {
        setError('Preencha os campos de Shield corretamente.');
        return;
      }
      
      const validationError = validateSkill(current, desired, 'Shield');
      if (validationError) {
        setError(validationError);
        return;
      }
      
      skills.shield = { current, desired };
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header flex items-center gap-2">
            <Link to="/calculators" className="hover:text-cream">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h2 className="font-semibold">Calculadora de Skills</h2>
          </header>
          <div className="news-box-content space-y-6">
            <p className="text-sm">
              Calcule quanto tempo você precisa treinar para atingir as skills desejadas.
            </p>

            {/* Seleção de Vocação */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Escolha sua Vocação:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {skillVocations.map((vocation) => (
                  <button
                    key={vocation.id}
                    onClick={() => handleVocationSelect(vocation)}
                    className={`p-3 rounded border text-center transition-colors ${
                      selectedVocation?.id === vocation.id
                        ? 'bg-maroon text-cream border-maroon'
                        : 'bg-cream border-border-light hover:bg-cream-dark'
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
                <h3 className="text-sm font-medium">Selecione as Skills:</h3>
                
                {/* Melee */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="melee"
                      checked={meleeEnabled}
                      onCheckedChange={(checked) => {
                        setMeleeEnabled(checked === true);
                        if (!checked) {
                          setMeleeCurrentSkill('');
                          setMeleeDesiredSkill('');
                        }
                        setResult(null);
                      }}
                    />
                    <label htmlFor="melee" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Sword className="w-4 h-4" /> Melee
                    </label>
                  </div>
                  {meleeEnabled && (
                    <div className="grid grid-cols-2 gap-3 ml-6">
                      <div className="space-y-1">
                        <label className="text-xs">Skill Atual:</label>
                        <Input
                          type="number"
                          value={meleeCurrentSkill}
                          onChange={(e) => {
                            setMeleeCurrentSkill(e.target.value);
                            setResult(null);
                          }}
                          placeholder="Ex: 10"
                          min={10}
                          className="bg-secondary text-text-dark border-border"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs">Skill Desejada:</label>
                        <Input
                          type="number"
                          value={meleeDesiredSkill}
                          onChange={(e) => {
                            setMeleeDesiredSkill(e.target.value);
                            setResult(null);
                          }}
                          placeholder="Ex: 50"
                          min={10}
                          className="bg-secondary text-text-dark border-border"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Distance */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="distance"
                      checked={distanceEnabled}
                      onCheckedChange={(checked) => {
                        setDistanceEnabled(checked === true);
                        if (!checked) {
                          setDistanceCurrentSkill('');
                          setDistanceDesiredSkill('');
                        }
                        setResult(null);
                      }}
                    />
                    <label htmlFor="distance" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Target className="w-4 h-4" /> Distance
                    </label>
                  </div>
                  {distanceEnabled && (
                    <div className="grid grid-cols-2 gap-3 ml-6">
                      <div className="space-y-1">
                        <label className="text-xs">Skill Atual:</label>
                        <Input
                          type="number"
                          value={distanceCurrentSkill}
                          onChange={(e) => {
                            setDistanceCurrentSkill(e.target.value);
                            setResult(null);
                          }}
                          placeholder="Ex: 10"
                          min={10}
                          className="bg-secondary text-text-dark border-border"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs">Skill Desejada:</label>
                        <Input
                          type="number"
                          value={distanceDesiredSkill}
                          onChange={(e) => {
                            setDistanceDesiredSkill(e.target.value);
                            setResult(null);
                          }}
                          placeholder="Ex: 80"
                          min={10}
                          className="bg-secondary text-text-dark border-border"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Shield */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="shield"
                      checked={shieldEnabled}
                      onCheckedChange={(checked) => {
                        setShieldEnabled(checked === true);
                        if (!checked) {
                          setShieldCurrentSkill('');
                          setShieldDesiredSkill('');
                        }
                        setResult(null);
                      }}
                    />
                    <label htmlFor="shield" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Shield
                    </label>
                  </div>
                  {shieldEnabled && (
                    <div className="grid grid-cols-2 gap-3 ml-6">
                      <div className="space-y-1">
                        <label className="text-xs">Skill Atual:</label>
                        <Input
                          type="number"
                          value={shieldCurrentSkill}
                          onChange={(e) => {
                            setShieldCurrentSkill(e.target.value);
                            setResult(null);
                          }}
                          placeholder="Ex: 10"
                          min={10}
                          className="bg-secondary text-text-dark border-border"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs">Skill Desejada:</label>
                        <Input
                          type="number"
                          value={shieldDesiredSkill}
                          onChange={(e) => {
                            setShieldDesiredSkill(e.target.value);
                            setResult(null);
                          }}
                          placeholder="Ex: 60"
                          min={10}
                          className="bg-secondary text-text-dark border-border"
                        />
                      </div>
                    </div>
                  )}
                </div>
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
                Calcular
              </Button>
            )}

            {/* Resultados */}
            {result && result.results.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b border-border-light pb-2">
                  Resultados para {result.vocation.name}
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
                        Tempo estimado para avançar de{' '}
                        <strong>{skillResult.currentSkill}</strong> para{' '}
                        <strong>{skillResult.desiredSkill}</strong>:
                      </p>
                      <p className="text-maroon font-semibold mt-1">
                        {formatTime(skillResult.time)}
                      </p>
                    </div>
                  ))}
                </div>
                
                {/* Imagem de treino */}
                <div className="flex justify-center pt-4">
                  <img
                    src="https://tibiara.netlify.app/en/img/treino.gif"
                    alt="Treino"
                    className="rounded"
                    width={340}
                    height={204}
                  />
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
