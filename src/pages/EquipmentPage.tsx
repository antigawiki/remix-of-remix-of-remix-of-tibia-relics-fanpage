import { useParams, Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import EquipmentTable from '@/components/EquipmentTable';
import { 
  helmets, armors, legs, boots, shields, swords, axes, clubs, distance, ammo,
  equipmentCategories, Equipment 
} from '@/data/equipment';
import { Shield, Sword, HardHat, Footprints, ChevronLeft, Crosshair, Shirt, Axe, Hammer } from 'lucide-react';
import { useTranslation } from '@/i18n';

const categoryData: Record<string, Equipment[]> = { helmets, armors, legs, boots, shields, swords, axes, clubs, distance, ammo };

const LegsIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12v4l-2 12h-2l-2-10-2 10h-2L6 8V4z" />
  </svg>
);

const ArrowAmmoIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5" />
    <polyline points="15 5 19 5 19 9" />
    <line x1="5" y1="19" x2="8" y2="16" />
    <line x1="5" y1="17" x2="7" y2="19" />
  </svg>
);

const categoryIcons: Record<string, React.ReactNode> = {
  helmets: <HardHat className="w-6 h-6" />, armors: <Shirt className="w-6 h-6" />, legs: <LegsIcon />,
  boots: <Footprints className="w-6 h-6" />, shields: <Shield className="w-6 h-6" />, swords: <Sword className="w-6 h-6" />,
  axes: <Axe className="w-6 h-6" />, clubs: <Hammer className="w-6 h-6" />, distance: <Crosshair className="w-6 h-6" />, ammo: <ArrowAmmoIcon />,
};

const EquipmentPage = () => {
  const { category } = useParams<{ category?: string }>();
  const { t } = useTranslation();

  if (!category) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <section className="news-box">
            <header className="news-box-header">
              <h1 className="font-semibold">{t('pages.equipment.title')}</h1>
            </header>
            <div className="news-box-content">
              <p className="text-sm leading-relaxed mb-4">{t('pages.equipment.description')}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(equipmentCategories).map(([key, cat]) => (
                  <Link key={key} to={cat.path} className="parchment p-4 rounded-sm flex flex-col items-center gap-2 hover:translate-y-[-2px] transition-transform text-center">
                    <div className="text-maroon">{categoryIcons[key]}</div>
                    <span className="font-heading font-semibold text-text-dark">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">{t('pages.equipment.itemCount').replace('{count}', String(categoryData[key]?.length || 0))}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </MainLayout>
    );
  }

  const items = categoryData[category] || [];
  const categoryInfo = equipmentCategories[category as keyof typeof equipmentCategories];

  if (!categoryInfo) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <section className="news-box">
            <header className="news-box-header"><h1 className="font-semibold">{t('pages.equipment.categoryNotFound')}</h1></header>
            <div className="news-box-content">
              <p>{t('pages.equipment.doesNotExist').replace('{category}', category)}</p>
              <Link to="/equipment" className="text-maroon hover:underline">{t('pages.equipment.backTo')}</Link>
            </div>
          </section>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <div className="flex items-center gap-2">
              <Link to="/equipment" className="hover:text-gold transition-colors"><ChevronLeft className="w-5 h-5" /></Link>
              <h1 className="font-semibold">{categoryInfo.name}</h1>
            </div>
          </header>
          <div className="news-box-content"><EquipmentTable items={items} category={category} /></div>
        </section>
      </div>
    </MainLayout>
  );
};

export default EquipmentPage;
