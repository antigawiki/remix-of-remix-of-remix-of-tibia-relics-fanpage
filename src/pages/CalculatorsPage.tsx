import MainLayout from '@/layouts/MainLayout';
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';

interface CalculatorCardProps {
  to: string;
  title: string;
  description: string;
}

const CalculatorCard = ({ to, title, description }: CalculatorCardProps) => (
  <Link 
    to={to} 
    className="flex flex-col items-center p-6 bg-cream border border-border-light rounded hover:shadow-md transition-shadow text-center"
  >
    <div className="w-12 h-12 flex items-center justify-center text-maroon mb-3">
      <Calculator className="w-10 h-10" />
    </div>
    <h3 className="font-semibold text-maroon mb-1">{title}</h3>
    <p className="text-xs text-muted-foreground">{description}</p>
  </Link>
);

const CalculatorsPage = () => {
  const calculators = [
    {
      to: '/calculators/damage',
      title: 'Dano',
      description: 'Calcule o dano de ataques e magias'
    },
    {
      to: '/calculators/experience',
      title: 'Experiência',
      description: 'Calcule XP necessária para upar'
    },
    {
      to: '/calculators/magic-level',
      title: 'Magic Level',
      description: 'Calcule mana necessária para ML'
    },
    {
      to: '/calculators/skills',
      title: 'Skills',
      description: 'Calcule treino de skills'
    },
    {
      to: '/calculators/loot',
      title: 'Loot',
      description: 'Calcule valor de loot'
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
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {calculators.map((calc) => (
                <CalculatorCard
                  key={calc.to}
                  to={calc.to}
                  title={calc.title}
                  description={calc.description}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Placeholder for future calculator content */}
        <section className="news-box">
          <header className="news-box-header">
            <h3 className="font-semibold">Em Breve</h3>
          </header>
          <div className="news-box-content">
            <p className="text-sm text-muted-foreground">
              As calculadoras estão em desenvolvimento. Em breve você poderá calcular dano, experiência, magic level, skills e loot!
            </p>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default CalculatorsPage;
