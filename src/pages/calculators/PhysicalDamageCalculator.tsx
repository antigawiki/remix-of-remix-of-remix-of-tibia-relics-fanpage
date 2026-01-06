import { useState, useMemo } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sword, Target, Shield, Sparkles } from "lucide-react";
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

  const handleSkillChange = (value: string) => {
    let num = parseInt(value) || 10;
    if (num < 10) num = 10;
    if (num > 140) num = 140;
    setSkill(num);
  };

  const handleWeaponAttackChange = (value: string) => {
    let num = parseInt(value) || 5;
    if (num < 5) num = 5;
    if (num > 55) num = 55;
    setWeaponAttack(num);
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
      <div className="space-y-6">
        {/* Header */}
        <section className="news-box">
          <div className="news-header flex items-center gap-2">
            <Sword className="w-5 h-5" />
            <span>Physical Damage Calculator (Melee)</span>
          </div>
          <div className="news-content space-y-6">
            {/* Vocation Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Choose your Vocation:</Label>
              <RadioGroup
                value={vocation}
                onValueChange={(v) => setVocation(v as Vocation)}
                className="flex flex-wrap gap-4"
              >
                {(Object.keys(vocationLabels) as Vocation[]).map((voc) => (
                  <div key={voc} className="flex items-center space-x-2">
                    <RadioGroupItem value={voc} id={voc} />
                    <Label htmlFor={voc} className="cursor-pointer flex items-center gap-1">
                      {voc === "knight" && <Shield className="w-4 h-4" />}
                      {voc === "paladin" && <Target className="w-4 h-4" />}
                      {voc === "sorcerer" && <Sparkles className="w-4 h-4" />}
                      {voc === "druid" && <Sparkles className="w-4 h-4" />}
                      {vocationLabels[voc]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Skill Input - Always visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skill">Skill (10-140)</Label>
                <Input
                  id="skill"
                  type="number"
                  min={10}
                  max={140}
                  value={skill}
                  onChange={(e) => handleSkillChange(e.target.value)}
                  className="bg-background"
                />
              </div>

              {/* Paladin: Ammo Selection */}
              {vocation === "paladin" && (
                <div className="space-y-2">
                  <Label htmlFor="ammo">Ammunition</Label>
                  <Select value={selectedAmmo} onValueChange={setSelectedAmmo}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ammoData.map((ammo) => (
                        <SelectItem key={ammo.id} value={ammo.id}>
                          <div className="flex items-center gap-2">
                            <img src={ammo.image} alt={ammo.name} className="w-6 h-6" />
                            <span>{ammo.name}</span>
                            <span className="text-muted-foreground text-xs">(Atk: {ammo.attack})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Other Vocations: Weapon Attack Input */}
              {vocation !== "paladin" && (
                <div className="space-y-2">
                  <Label htmlFor="weaponAttack">Weapon Attack (5-55)</Label>
                  <Input
                    id="weaponAttack"
                    type="number"
                    min={5}
                    max={55}
                    value={weaponAttack}
                    onChange={(e) => handleWeaponAttackChange(e.target.value)}
                    className="bg-background"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="news-box">
          <div className="news-header flex items-center gap-2">
            <Target className="w-5 h-5" />
            <span>Damage Result</span>
          </div>
          <div className="news-content">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="text-center md:text-left">
                  <p className="text-sm text-muted-foreground mb-1">
                    The maximum damage you will achieve is approximately:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="bg-accent/30 rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">vs Monsters (PvE)</p>
                      <p className="text-3xl font-bold text-primary">{result.maxDamage}</p>
                    </div>
                    <div className="bg-destructive/20 rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">vs Players (PvP)</p>
                      <p className="text-3xl font-bold text-destructive">{result.pvpDamage}</p>
                    </div>
                  </div>
                </div>

                {/* Ammo info for Paladin */}
                {vocation === "paladin" && selectedAmmoData && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <img src={selectedAmmoData.image} alt={selectedAmmoData.name} className="w-6 h-6" />
                    <span>Using {selectedAmmoData.name} (Attack: {selectedAmmoData.attack})</span>
                  </div>
                )}
              </div>

              {/* Vocation Image */}
              <div className="flex-shrink-0">
                <img
                  src={vocationImages[vocation]}
                  alt={vocationLabels[vocation]}
                  className="w-48 h-auto rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default PhysicalDamageCalculator;
