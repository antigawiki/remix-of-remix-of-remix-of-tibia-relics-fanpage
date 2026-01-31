import { useTranslation } from '@/i18n';

const ServerInfo = () => {
  const { t } = useTranslation();

  return (
    <div className="news-box">
      <header className="news-box-header">
        <h3 className="font-semibold">{t('serverInfo.title')}</h3>
      </header>
      <div className="news-box-content space-y-4">
        {/* Rates */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon dark:text-gold mb-2 border-b border-border pb-1">
            {t('serverInfo.rates')}
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('serverInfo.experience')}:</span>
              <span className="font-semibold">1x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('serverInfo.magic')}:</span>
              <span className="font-semibold">1x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('serverInfo.skills')}:</span>
              <span className="font-semibold">1x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('serverInfo.loot')}:</span>
              <span className="font-semibold">1x</span>
            </div>
          </div>
        </div>

        {/* Skull System */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon dark:text-gold mb-2 border-b border-border pb-1">
            {t('serverInfo.skullSystem')}
          </h4>
          <div className="space-y-3 text-sm">
            {/* Tempo PZ */}
            <div className="bg-muted/30 rounded p-2">
              <span className="text-foreground font-medium block mb-1">⏱️ {t('serverInfo.pzTime')}</span>
              <span className="text-muted-foreground">{t('serverInfo.pzTimeValue')}</span>
            </div>

            {/* White Skull */}
            <div className="bg-muted/30 rounded p-2">
              <span className="text-foreground font-medium block mb-1">💀 {t('serverInfo.whiteSkull')}</span>
              <div className="text-muted-foreground space-y-0.5">
                <div>
                  • {t('serverInfo.upTo')} <span className="font-semibold">2 {t('serverInfo.kills')}</span> in 24 {t('serverInfo.hours')}
                </div>
                <div>
                  • {t('serverInfo.upTo')} <span className="font-semibold">4 {t('serverInfo.kills')}</span> in 7 {t('serverInfo.days')}
                </div>
                <div>
                  • {t('serverInfo.upTo')} <span className="font-semibold">9 {t('serverInfo.kills')}</span> in 30 {t('serverInfo.days')}
                </div>
              </div>
            </div>

            {/* Red Skull */}
            <div className="bg-destructive/10 rounded p-2 border border-destructive/20">
              <span className="text-destructive font-medium block mb-1">☠️ {t('serverInfo.redSkull')}</span>
              <div className="text-muted-foreground space-y-0.5">
                <div>
                  • {t('serverInfo.from')} <span className="font-semibold">3 {t('serverInfo.kills')}</span> in 24 {t('serverInfo.hours')}
                </div>
                <div>
                  • {t('serverInfo.from')} <span className="font-semibold">5 {t('serverInfo.kills')}</span> in 7 {t('serverInfo.days')}
                </div>
                <div>
                  • {t('serverInfo.from')} <span className="font-semibold">10 {t('serverInfo.kills')}</span> in 30 {t('serverInfo.days')}
                </div>
              </div>
            </div>

            {/* Ban */}
            <div className="bg-destructive/20 rounded p-2 border border-destructive/30">
              <span className="text-destructive font-medium block mb-1">🚫 {t('serverInfo.fragsBan')}</span>
              <span className="text-muted-foreground">{t('serverInfo.banDescription')}</span>
            </div>
          </div>
        </div>

        {/* General */}
        <div>
          <h4 className="font-heading text-sm font-semibold text-maroon dark:text-gold mb-2 border-b border-border pb-1">
            {t('serverInfo.general')}
          </h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• {t('serverInfo.updatesComingSoon')}</li>
            <li>• {t('serverInfo.visitOfficialSite')}</li>
          </ul>
        </div>

        <a
          href="https://tibiarelic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="retro-btn block text-center w-full mt-4"
        >
          {t('serverInfo.accessOfficialSite')}
        </a>
      </div>
    </div>
  );
};

export default ServerInfo;
