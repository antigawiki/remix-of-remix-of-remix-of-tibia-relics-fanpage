import { Trophy, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { useTopGainers, formatExperience } from '@/hooks/useTopGainers';
import { Skeleton } from '@/components/ui/skeleton';
import PlayerLink from '@/components/PlayerLink';
import { useTranslation } from '@/i18n';

const TopGainersPage = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useTopGainers(50);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-gold" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono">{rank}</span>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <h1 className="font-heading text-lg font-semibold">{t('pages.topGainers.title')}</h1>
          </div>
          <div className="p-4">
            <p className="text-muted-foreground text-sm">
              {t('pages.topGainers.description')}
            </p>
            {data?.periodStart && data?.periodEnd && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <Calendar className="w-4 h-4 text-gold" />
                <span>
                  {t('pages.topGainers.period')}: <strong>{formatDate(data.periodStart)}</strong> → <strong>{formatDate(data.periodEnd)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-2">
            <span className="font-heading text-sm font-semibold">{t('pages.topGainers.xpRanking')}</span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>{t('pages.topGainers.errorLoading')}</p>
            </div>
          ) : data?.message ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gold" />
              <p className="text-muted-foreground">{data.message}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('pages.topGainers.dataCollected')}
              </p>
            </div>
          ) : data?.gainers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>{t('pages.topGainers.noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-12">#</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{t('pages.topGainers.columns.name')}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{t('pages.topGainers.columns.vocation')}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{t('pages.topGainers.columns.level')}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{t('pages.topGainers.columns.xpGained')}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{t('pages.topGainers.columns.xpTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data?.gainers.map((gainer) => (
                    <tr key={gainer.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center w-6">
                          {getRankIcon(gainer.rank)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PlayerLink name={gainer.name} className="font-medium" />
                        {gainer.isNewPlayer && (
                          <span className="ml-2 text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                            {t('pages.topGainers.new')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {gainer.profession || t('pages.topGainers.noVocation')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {gainer.level}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-green-400">
                        +{formatExperience(gainer.experienceGained)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                        {formatExperience(gainer.currentExperience)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default TopGainersPage;
