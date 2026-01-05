import { useParams, Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import EquipmentTable from '@/components/EquipmentTable';
import { 
  helmets, armors, legs, boots, shields, swords, axes, clubs, distance, ammo,
  equipmentCategories, Equipment 
} from '@/data/equipment';
import { Shield, Sword, HardHat, Footprints, ChevronLeft, Crosshair, ArrowUp, Shirt, Axe, Hammer } from 'lucide-react';

const categoryData: Record<string, Equipment[]> = {
  helmets,
  armors,
  legs,
  boots,
  shields,
  swords,
  axes,
  clubs,
  distance,
  ammo,
};

const categoryIcons: Record<string, React.ReactNode> = {
  helmets: <HardHat className="w-6 h-6" />,
  armors: <Shirt className="w-6 h-6" />,
  legs: <span className="w-6 h-6 flex items-center justify-center text-lg">👖</span>,
  boots: <Footprints className="w-6 h-6" />,
  shields: <Shield className="w-6 h-6" />,
  swords: <Sword className="w-6 h-6" />,
  axes: <Axe className="w-6 h-6" />,
  clubs: <Hammer className="w-6 h-6" />,
  distance: <Crosshair className="w-6 h-6" />,
  ammo: <ArrowUp className="w-6 h-6" />,
};

const EquipmentPage = () => {
  const { category } = useParams<{ category?: string }>();

  // Show category grid if no category selected
  if (!category) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <section className="news-box">
            <header className="news-box-header">
              <h1 className="font-semibold">Equipamentos</h1>
            </header>
            <div className="news-box-content">
              <p className="text-sm leading-relaxed mb-4">
                Explore todos os equipamentos disponíveis no Tibia Relic. 
                Clique em uma categoria para ver os itens disponíveis.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(equipmentCategories).map(([key, cat]) => (
                  <Link
                    key={key}
                    to={cat.path}
                    className="parchment p-4 rounded-sm flex flex-col items-center gap-2 hover:translate-y-[-2px] transition-transform text-center"
                  >
                    <div className="text-maroon">
                      {categoryIcons[key]}
                    </div>
                    <span className="font-heading font-semibold text-text-dark">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {categoryData[key]?.length || 0} itens
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </MainLayout>
    );
  }

  // Get items for selected category
  const items = categoryData[category] || [];
  const categoryInfo = equipmentCategories[category as keyof typeof equipmentCategories];

  if (!categoryInfo) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <section className="news-box">
            <header className="news-box-header">
              <h1 className="font-semibold">Categoria não encontrada</h1>
            </header>
            <div className="news-box-content">
              <p>A categoria "{category}" não existe.</p>
              <Link to="/equipment" className="text-maroon hover:underline">
                Voltar para equipamentos
              </Link>
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
              <Link to="/equipment" className="hover:text-gold transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-semibold">{categoryInfo.name}</h1>
            </div>
          </header>
          <div className="news-box-content">
            <EquipmentTable items={items} category={category} />
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default EquipmentPage;
