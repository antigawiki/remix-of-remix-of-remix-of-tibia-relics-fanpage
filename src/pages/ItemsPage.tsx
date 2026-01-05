import { useParams, Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import ItemsTable from '@/components/ItemsTable';
import { 
  foods, amulets, rings, valuables, backpacks,
  itemCategories, Item 
} from '@/data/items';
import { Cookie, Diamond, Backpack, ChevronLeft } from 'lucide-react';

const categoryData: Record<string, Item[]> = {
  foods,
  amulets,
  rings,
  valuables,
  backpacks,
};

// Custom SVG icons
const NecklaceIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C8 2 5 5 5 8c0 2 1 3.5 2 4.5L12 22l5-9.5c1-1 2-2.5 2-4.5 0-3-3-6-7-6z" />
    <circle cx="12" cy="9" r="2" />
  </svg>
);

const RingIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="14" rx="7" ry="5" />
    <path d="M5 14V10c0-2.5 3-5 7-5s7 2.5 7 5v4" />
    <rect x="10" y="5" width="4" height="4" rx="1" />
  </svg>
);

const categoryIcons: Record<string, React.ReactNode> = {
  foods: <Cookie className="w-6 h-6" />,
  amulets: <NecklaceIcon />,
  rings: <RingIcon />,
  valuables: <Diamond className="w-6 h-6" />,
  backpacks: <Backpack className="w-6 h-6" />,
};

const ItemsPage = () => {
  const { category } = useParams<{ category?: string }>();

  // Show category grid if no category selected
  if (!category) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <section className="news-box">
            <header className="news-box-header">
              <h1 className="font-semibold">Itens</h1>
            </header>
            <div className="news-box-content">
              <p className="text-sm leading-relaxed mb-4">
                Explore todos os itens disponíveis no Tibia Relic. 
                Clique em uma categoria para ver os itens disponíveis.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(itemCategories).map(([key, cat]) => (
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
  const categoryInfo = itemCategories[category as keyof typeof itemCategories];

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
              <Link to="/items" className="text-maroon hover:underline">
                Voltar para itens
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
              <Link to="/items" className="hover:text-gold transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-semibold">{categoryInfo.name}</h1>
            </div>
          </header>
          <div className="news-box-content">
            <ItemsTable items={items} category={category} />
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default ItemsPage;
