import { useState, useMemo } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ammoData,
  calculatePhysicalDamage,
  vocationImages,
  vocationLabels,
  type Vocation,
} from "@/data/calculators/physicalDamage";

const PhysicalDamageCalculator = () => {
  const [vocation, setVocation] = useState<Vocation>("knight");
  const [skill, setSkill] = useState<number>(10);
  const [weaponAttack, setWeaponAttack] = useState<number>(5);
  const [selectedAmmo, setSelectedAmmo] = useState<string>("arrow");

  const handleSkillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSkill(isNaN(value) ? 0 : value);
  };

  const handleWeaponAttackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setWeaponAttack(isNaN(value) ? 0 : value);
  };

  const result = useMemo(() => {
    if (vocation === "paladin") {
      const ammo = ammoData.find((a) => a.id === selectedAmmo);
      if (ammo) {
        return calculatePhysicalDamage(skill, ammo.attack);
      }
    }
    return calculatePhysicalDamage(skill, weaponAttack);
  }, [vocation, skill, weaponAttack, selectedAmmo]);

  const selectedAmmoData = ammoData.find((a) => a.id === selectedAmmo);

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <section className="news-box">
          <header className="news-box-header">
            <h1 className="text-lg font-bold">Calculadora de Dano Físico (Melee)</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm mb-4">
              Calcule o dano físico baseado na sua vocação, skill e ataque da arma/munição.
            </p>
            
            {/* Vocation Selection */}
            <div className="parchment p-4 rounded-sm mb-4">
              <Label className="text-text-dark font-semibold block mb-3">Escolha sua Vocação:</Label>
              <RadioGroup
                value={vocation}
                onValueChange={(v) => setVocation(v as Vocation)}
                className="flex flex-wrap gap-4"
              >
                {(Object.keys(vocationLabels) as Vocation[]).map((voc) => (
                  <div key={voc} className="flex items-center space-x-2">
                    <RadioGroupItem value={voc} id={voc} className="border-maroon text-maroon" />
                    <Label htmlFor={voc} className="cursor-pointer text-text-dark font-medium">
                      {vocationLabels[voc]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Input Controls */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="skill" className="text-text-dark font-semibold whitespace-nowrap">
                  Skill:
                </Label>
                <Input
                  id="skill"
                  type="number"
                  value={skill}
                  onChange={handleSkillChange}
                  className="w-24 bg-secondary text-text-dark border-border"
                />
              </div>

              {/* Paladin: Ammo Selection */}
              {vocation === "paladin" && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="ammo" className="text-text-dark font-semibold whitespace-nowrap">
                    Munição:
                  </Label>
                  <Select value={selectedAmmo} onValueChange={setSelectedAmmo}>
                    <SelectTrigger className="w-44 bg-secondary text-text-dark border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ammoData.map((ammo) => (
                        <SelectItem key={ammo.id} value={ammo.id}>
                          <div className="flex items-center gap-2">
                            <img src={ammo.image} alt={ammo.name} className="w-5 h-5" />
                            <span>{ammo.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Other Vocations: Weapon Attack Input */}
              {vocation !== "paladin" && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="weaponAttack" className="text-text-dark font-semibold whitespace-nowrap">
                    Ataque da Arma:
                  </Label>
                  <Input
                    id="weaponAttack"
                    type="number"
                    value={weaponAttack}
                    onChange={handleWeaponAttackChange}
                    className="w-24 bg-secondary text-text-dark border-border"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Resultado do Cálculo</h2>
          </header>
          <div className="news-box-content">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Results Cards */}
              <div className="flex-1 w-full">
                <p className="text-sm text-text-dark mb-4">
                  O dano máximo que você alcançará é aproximadamente:
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {/* PvE Damage */}
                  <div className="parchment p-4 rounded-sm text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      vs Monstros (PvE)
                    </div>
                    <div className="text-4xl font-heading font-bold text-maroon">
                      {result.maxDamage}
                    </div>
                  </div>
                  
                  {/* PvP Damage */}
                  <div className="parchment p-4 rounded-sm text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      vs Jogadores (PvP)
                    </div>
                    <div className="text-4xl font-heading font-bold text-red-700">
                      {result.pvpDamage}
                    </div>
                  </div>
                </div>

                {/* Extra Info */}
                <div className="parchment p-3 rounded-sm">
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div>
                      <div className="text-muted-foreground mb-1">Vocação</div>
                      <div className="bg-secondary/50 rounded px-2 py-1 text-text-dark font-medium">
                        {vocationLabels[vocation]}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Skill</div>
                      <div className="bg-secondary/50 rounded px-2 py-1 text-text-dark font-medium">
                        {skill}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">
                        {vocation === "paladin" ? "Munição" : "Atk Arma"}
                      </div>
                      <div className="bg-secondary/50 rounded px-2 py-1 text-text-dark font-medium flex items-center justify-center gap-1">
                        {vocation === "paladin" && selectedAmmoData ? (
                          <>
                            <img src={selectedAmmoData.image} alt={selectedAmmoData.name} className="w-4 h-4" />
                            <span>{selectedAmmoData.attack}</span>
                          </>
                        ) : (
                          <span>{weaponAttack}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vocation Image */}
              <div className="flex-shrink-0">
                <div className="parchment p-3 rounded-sm">
                  <img
                    src={vocationImages[vocation]}
                    alt={vocationLabels[vocation]}
                    className="w-48 h-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default PhysicalDamageCalculator;
