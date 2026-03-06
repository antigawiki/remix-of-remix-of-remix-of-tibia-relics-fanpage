import MainLayout from '@/layouts/MainLayout';
import CreaturesTable from '@/components/CreaturesTable';
import { creatures } from '@/data/creatures';
import { useTranslation } from '@/i18n';

const CreaturesPage = () => {
  const { t } = useTranslation();

  return (
    <MainLayout showSidebars={false}>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h1 className="font-semibold">{t('pages.creatures.title')}</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm leading-relaxed mb-4">
              {t('pages.creatures.description')}
            </p>
            
            <CreaturesTable creatures={creatures} />
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default CreaturesPage;
