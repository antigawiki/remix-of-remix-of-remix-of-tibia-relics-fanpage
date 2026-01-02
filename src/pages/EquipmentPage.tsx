import MainLayout from '@/layouts/MainLayout';
import CategoryGrid from '@/components/CategoryGrid';

const EquipmentPage = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h1 className="font-semibold">Equipamentos</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm leading-relaxed">
              Explore todos os equipamentos disponíveis no Tibia Relics. 
              Clique em uma categoria para ver os itens disponíveis.
            </p>
          </div>
        </section>

        <CategoryGrid />
      </div>
    </MainLayout>
  );
};

export default EquipmentPage;
