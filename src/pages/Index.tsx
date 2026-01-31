import MainLayout from '@/layouts/MainLayout';
import NewsBox from '@/components/NewsBox';
import ServerInfo from '@/components/ServerInfo';
import { useTranslation } from '@/i18n';

const Index = () => {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <section className="news-box">
          <header className="news-box-header">
            <h2 className="font-semibold">{t('home.welcomeTitle')}</h2>
          </header>
          <div className="news-box-content">
            <p className="text-sm leading-relaxed mb-4">
              {t('home.welcomeDescription')}
            </p>
            <div className="flex flex-wrap gap-2">
              <a 
                href="https://www.tibiarelic.com/register" 
                target="_blank" 
                rel="noopener noreferrer"
                className="retro-btn"
              >
                {t('home.createAccount')}
              </a>
              <a 
                href="https://public.tibiarelic.com/client/Tibia%20Relic.zip" 
                target="_blank" 
                rel="noopener noreferrer"
                className="retro-btn"
              >
                {t('home.downloadClient')}
              </a>
            </div>
          </div>
        </section>

        {/* News Feed */}
        <section>
          <div className="section-divider mb-4" />
          <h2 className="font-heading text-xl text-gold mb-4">{t('home.latestNews')}</h2>
          
          <div className="space-y-4">
            <NewsBox 
              title="Wiki em Construção"
              date="02/01/2024"
              author="Admin"
              content="<p>Estamos trabalhando para trazer todas as informações do servidor Tibia Relic para você! Em breve teremos guias completos de equipamentos, magias, quests e muito mais.</p><p class='mt-2'>Fique ligado nas atualizações!</p>"
            />
            
            <NewsBox 
              title="Tibia Relic - O Servidor"
              date="01/01/2024"
              author="Admin"
              content="<p>Tibia Relic é um servidor OT que traz a nostalgia do Tibia clássico com algumas melhorias. Visite o site oficial em <a href='https://tibiarelic.com' target='_blank' class='text-maroon hover:underline'>tibiarelic.com</a> para criar sua conta e começar a jogar!</p>"
            />
          </div>
        </section>

        {/* Server Info (Mobile) */}
        <section className="lg:hidden">
          <div className="section-divider mb-4" />
          <h2 className="font-heading text-xl text-gold mb-4">{t('home.serverInfo')}</h2>
          <ServerInfo />
        </section>
      </div>
    </MainLayout>
  );
};

export default Index;
