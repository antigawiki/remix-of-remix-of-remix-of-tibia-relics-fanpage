import MainLayout from '@/layouts/MainLayout';
import Breadcrumb from '@/components/Breadcrumb';
import RunesTable from '@/components/RunesTable';
import { useTranslation } from '@/i18n';

const RunesPage = () => {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <Breadcrumb />

      <div className="wood-panel rounded-sm overflow-hidden">
        <div className="maroon-header px-4 py-3">
          <h1 className="font-heading text-xl font-bold">{t('pages.runes.title')}</h1>
        </div>
        <div className="p-4">
          <p className="text-muted-foreground mb-6">{t('pages.runes.description')}</p>
          <RunesTable />
        </div>
      </div>
    </MainLayout>
  );
};

export default RunesPage;
