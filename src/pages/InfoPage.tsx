import MainLayout from '@/layouts/MainLayout';
import ServerInfo from '@/components/ServerInfo';

const InfoPage = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="news-box">
          <header className="news-box-header">
            <h1 className="font-semibold">Informações do Servidor</h1>
          </header>
          <div className="news-box-content">
            <p className="text-sm leading-relaxed">
              Todas as informações sobre rates, sistema de skull, casas e mecânicas do Tibia Relics.
            </p>
          </div>
        </section>

        <ServerInfo />
      </div>
    </MainLayout>
  );
};

export default InfoPage;
