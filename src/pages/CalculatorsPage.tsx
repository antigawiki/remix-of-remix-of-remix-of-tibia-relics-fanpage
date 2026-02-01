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
import { useTranslation } from '@/i18n';

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
  const { t } = useTranslation();

  const calculators = [
    {
      to: '/calculators/heal-damage',
      title: t('pages.calculatorsPage.cards.healDamage.title'),
      description: t('pages.calculatorsPage.cards.healDamage.description'),
      icon: <Sparkles className="w-10 h-10" />
    },
    {
      to: '/calculators/physical-damage',
      title: t('pages.calculatorsPage.cards.physicalDamage.title'),
      description: t('pages.calculatorsPage.cards.physicalDamage.description'),
      icon: <Swords className="w-10 h-10" />
    },
    {
      to: '/calculators/death-experience',
      title: t('pages.calculatorsPage.cards.deathExperience.title'),
      description: t('pages.calculatorsPage.cards.deathExperience.description'),
      icon: <Skull className="w-10 h-10" />
    },
    {
      to: '/calculators/experience-level',
      title: t('pages.calculatorsPage.cards.experienceLevel.title'),
      description: t('pages.calculatorsPage.cards.experienceLevel.description'),
      icon: <TrendingUp className="w-10 h-10" />
    },
    {
      to: '/calculators/magic-level',
      title: t('pages.calculatorsPage.cards.magicLevel.title'),
      description: t('pages.calculatorsPage.cards.magicLevel.description'),
      icon: <BookOpen className="w-10 h-10" />
    },
    {
      to: '/calculators/loot',
      title: t('pages.calculatorsPage.cards.loot.title'),
      description: t('pages.calculatorsPage.cards.loot.description'),
      icon: <Coins className="w-10 h-10" />
    },
    {
      to: '/calculators/skills',
      title: t('pages.calculatorsPage.cards.skills.title'),
      description: t('pages.calculatorsPage.cards.skills.description'),
      icon: <Target className="w-10 h-10" />
    },
    {
      to: '/calculators/stats',
      title: t('pages.calculatorsPage.cards.stats.title'),
      description: t('pages.calculatorsPage.cards.stats.description'),
      icon: <Heart className="w-10 h-10" />
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">{t('pages.calculatorsPage.title')}</h2>
          </header>
          <div className="news-box-content">
            <p className="text-sm mb-6">
              {t('pages.calculatorsPage.description')}
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
