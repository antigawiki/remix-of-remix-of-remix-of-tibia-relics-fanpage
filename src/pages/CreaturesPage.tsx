import MainLayout from '@/layouts/MainLayout';
import CreaturesTable from '@/components/CreaturesTable';
import { creatures } from '@/data/creatures';

const CreaturesPage = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h1 className="font-semibold">Criaturas</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm leading-relaxed mb-4">
              Lista completa de todas as criaturas do Tibia Relic. 
              Use a busca para encontrar uma criatura específica ou ordene por qualquer coluna.
            </p>
            
            <CreaturesTable creatures={creatures} />
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default CreaturesPage;
