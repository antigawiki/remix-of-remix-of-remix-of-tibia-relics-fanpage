import { Link } from 'react-router-dom';
import { 
  Shield, Swords, Wand2, Bug, Scroll, Calculator,
  HardHat, Shirt, Footprints, ShieldCheck,
  Sword, Axe, Hammer, Target, Crosshair,
  Cookie, Gem, CircleDot, Briefcase, Sparkles
} from 'lucide-react';

interface CategoryItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const CategoryItem = ({ to, icon, label }: CategoryItemProps) => (
  <Link to={to} className="category-item">
    <div className="text-maroon">{icon}</div>
    <span>{label}</span>
  </Link>
);

interface CategorySectionProps {
  title: string;
  children: React.ReactNode;
}

const CategorySection = ({ title, children }: CategorySectionProps) => (
  <section className="news-box">
    <header className="news-box-header">
      <h3 className="font-semibold">{title}</h3>
    </header>
    <div className="news-box-content">
      <div className="category-grid">
        {children}
      </div>
    </div>
  </section>
);

const CategoryGrid = () => {
  return (
    <div className="space-y-4">
      {/* Armors */}
      <CategorySection title="Armaduras">
        <CategoryItem to="/equipment/helmets" icon={<HardHat className="w-8 h-8" />} label="Capacetes" />
        <CategoryItem to="/equipment/armors" icon={<Shirt className="w-8 h-8" />} label="Armaduras" />
        <CategoryItem to="/equipment/legs" icon={<Sparkles className="w-8 h-8" />} label="Pernas" />
        <CategoryItem to="/equipment/boots" icon={<Footprints className="w-8 h-8" />} label="Botas" />
        <CategoryItem to="/equipment/shields" icon={<ShieldCheck className="w-8 h-8" />} label="Escudos" />
      </CategorySection>

      {/* Weapons */}
      <CategorySection title="Armas">
        <CategoryItem to="/equipment/swords" icon={<Sword className="w-8 h-8" />} label="Espadas" />
        <CategoryItem to="/equipment/axes" icon={<Axe className="w-8 h-8" />} label="Machados" />
        <CategoryItem to="/equipment/clubs" icon={<Hammer className="w-8 h-8" />} label="Clavas" />
        <CategoryItem to="/equipment/distance" icon={<Crosshair className="w-8 h-8" />} label="Distância" />
        <CategoryItem to="/equipment/ammo" icon={<Target className="w-8 h-8" />} label="Munição" />
      </CategorySection>

      {/* Items */}
      <CategorySection title="Itens">
        <CategoryItem to="/items/food" icon={<Cookie className="w-8 h-8" />} label="Comidas" />
        <CategoryItem to="/items/amulets" icon={<Gem className="w-8 h-8" />} label="Amuletos" />
        <CategoryItem to="/items/rings" icon={<CircleDot className="w-8 h-8" />} label="Anéis" />
        <CategoryItem to="/items/valuables" icon={<Gem className="w-8 h-8" />} label="Valiosos" />
        <CategoryItem to="/items/backpacks" icon={<Briefcase className="w-8 h-8" />} label="Mochilas" />
      </CategorySection>

      {/* Spells */}
      <CategorySection title="Magias">
        <CategoryItem to="/spells/sorcerer" icon={<Wand2 className="w-8 h-8" />} label="Sorcerer" />
        <CategoryItem to="/spells/druid" icon={<Wand2 className="w-8 h-8" />} label="Druid" />
        <CategoryItem to="/spells/paladin" icon={<Crosshair className="w-8 h-8" />} label="Paladin" />
        <CategoryItem to="/spells/knight" icon={<Sword className="w-8 h-8" />} label="Knight" />
      </CategorySection>

      {/* Creatures & Quests */}
      <CategorySection title="Mundo">
        <CategoryItem to="/creatures" icon={<Bug className="w-8 h-8" />} label="Criaturas" />
        <CategoryItem to="/raids" icon={<Bug className="w-8 h-8" />} label="Raids" />
        <CategoryItem to="/quests" icon={<Scroll className="w-8 h-8" />} label="Quests" />
        <CategoryItem to="/quests/rook" icon={<Scroll className="w-8 h-8" />} label="Rook Quests" />
      </CategorySection>

      {/* Calculators */}
      <CategorySection title="Calculadoras">
        <CategoryItem to="/calc/damage" icon={<Calculator className="w-8 h-8" />} label="Dano" />
        <CategoryItem to="/calc/exp" icon={<Calculator className="w-8 h-8" />} label="Experiência" />
        <CategoryItem to="/calc/ml" icon={<Calculator className="w-8 h-8" />} label="Magic Level" />
        <CategoryItem to="/calc/skills" icon={<Calculator className="w-8 h-8" />} label="Skills" />
        <CategoryItem to="/calc/loot" icon={<Calculator className="w-8 h-8" />} label="Loot" />
      </CategorySection>
    </div>
  );
};

export default CategoryGrid;
