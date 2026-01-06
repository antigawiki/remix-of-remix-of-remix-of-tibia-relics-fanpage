import MainLayout from '@/layouts/MainLayout';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  Swords, 
  Skull, 
  TrendingUp, 
  BookOpen, 
  Coins, 
  Target, 
  Heart 
} from 'lucide-react';
import { ReactNode } from 'react';

interface CalculatorCardProps {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const CalculatorCard = ({ to, title, description, icon }: CalculatorCardProps) => (
  <Link 
    to={to} 
    className="flex flex-col items-center p-6 bg-cream border border-border-light rounded hover:shadow-md transition-shadow text-center"
  >
    <div className="w-12 h-12 flex items-center justify-center text-maroon mb-3">
      {icon}
    </div>
    <h3 className="font-semibold text-maroon mb-1 text-sm">{title}</h3>
    <p className="text-xs text-muted-foreground">{description}</p>
  </Link>
);

const CalculatorsPage = () => {
  const calculators = [
    {
      to: '/calculators/heal-damage',
      title: 'Heal / Dano com Magias',
      description: 'Calcule heal e dano de magias',
      icon: <Sparkles className="w-10 h-10" />
    },
    {
      to: '/calculators/physical-damage',
      title: 'Dano Físico (Skill/Arma)',
      description: 'Calcule dano baseado em skill e arma',
      icon: <Swords className="w-10 h-10" />
    },
    {
      to: '/calculators/death-experience',
      title: 'Experiência na Morte',
      description: 'Calcule XP perdida ao morrer',
      icon: <Skull className="w-10 h-10" />
    },
    {
      to: '/calculators/experience-level',
      title: 'Experiência / Level',
      description: 'Calcule XP necessária para upar',
      icon: <TrendingUp className="w-10 h-10" />
    },
    {
      to: '/calculators/magic-level',
      title: 'Magic Level',
      description: 'Calcule mana necessária para ML',
      icon: <BookOpen className="w-10 h-10" />
    },
    {
      to: '/calculators/loot',
      title: 'Calculadora de Loot',
      description: 'Calcule valor do seu loot',
      icon: <Coins className="w-10 h-10" />
    },
    {
      to: '/calculators/skills',
      title: 'Skills',
      description: 'Calcule treino de skills',
      icon: <Target className="w-10 h-10" />
    },
    {
      to: '/calculators/stats',
      title: 'Stats (HP, MP, CAP)',
      description: 'Calcule HP, Mana e Capacidade',
      icon: <Heart className="w-10 h-10" />
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">Calculadoras</h2>
          </header>
          <div className="news-box-content">
            <p className="text-sm mb-6">
              Utilize nossas calculadoras para planejar seu personagem e otimizar sua gameplay.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {calculators.map((calc) => (
                <CalculatorCard
                  key={calc.to}
                  to={calc.to}
                  title={calc.title}
                  description={calc.description}
                  icon={calc.icon}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default CalculatorsPage;
