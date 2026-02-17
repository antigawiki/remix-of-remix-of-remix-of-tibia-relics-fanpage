import { useTranslation } from '@/i18n';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="wood-panel mt-8 py-6">
      <div className="container">
        <div className="section-divider mb-4" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>{t('footer.developedBy')}</span>
            <span> Josuba</span>
          </div>

          <div className="text-center">
            <p>{t('footer.fanPage')} © 2026</p>
            <p className="text-xs mt-1">{t('footer.trademark')}</p>
          </div>

          <div>
            <a
              href="https://tibiarelic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="gold-link hover:underline"
            >
              tibiarelic.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
