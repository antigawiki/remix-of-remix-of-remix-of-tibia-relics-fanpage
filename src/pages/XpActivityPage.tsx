import { Activity, TrendingUp, Users, Clock, AlertCircle, RefreshCw, Zap, Sword } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { useXpActivity, formatXp } from '@/hooks/useXpActivity';
import { Skeleton } from '@/components/ui/skeleton';
import PlayerLink from '@/components/PlayerLink';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

const PROFESSION_COLORS: Record<string, string> = {
  Knight: 'text-red-400',
  Elite: 'text-red-400',
  Paladin: 'text-yellow-400',
  Royal: 'text-yellow-400',
  Sorcerer: 'text-blue-400',
  Master: 'text-blue-400',
  Druid: 'text-green-400',
  Elder: 'text-green-400',
};

const getProfessionColor = (profession: string) => {
  for (const [key, cls] of Object.entries(PROFESSION_COLORS)) {
    if (profession?.includes(key)) return cls;
  }
  return 'text-muted-foreground';
};

const formatTime = (iso: string | null) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const XpActivityPage = () => {
  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useXpActivity();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['xp-activity'] });
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              <h1 className="font-heading text-lg font-semibold">XP em Tempo Real</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="text-white hover:bg-primary/20 gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="p-4">
            <p className="text-muted-foreground text-sm">
              Jogadores ganhando XP agora — atualizado a cada 5 minutos via snapshot automático.
            </p>
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Última atualização: {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        {data && !data.message && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="wood-panel p-3 rounded-sm">
              <div className="flex items-center gap-2 mb-1">
                <Sword className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Em hunt agora</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{data.activeNow}</p>
            </div>
            <div className="wood-panel p-3 rounded-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-gold" />
                <span className="text-xs text-muted-foreground">Total rastreados</span>
              </div>
              <p className="text-2xl font-bold text-gold">{data.totalTracked}</p>
            </div>
            <div className="wood-panel p-3 rounded-sm">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Snapshot anterior</span>
              </div>
              <p className="text-lg font-bold text-blue-400">{formatTime(data.previousAt)}</p>
            </div>
            <div className="wood-panel p-3 rounded-sm">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">Snapshot atual</span>
              </div>
              <p className="text-lg font-bold text-purple-400">{formatTime(data.latestAt)}</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="font-heading text-sm font-semibold">Ranking de Hunt (Período Atual)</span>
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
              <p>Erro ao carregar dados de atividade.</p>
            </div>
          ) : data?.message ? (
            <div className="p-8 text-center">
              <Activity className="w-10 h-10 mx-auto mb-3 text-gold opacity-50" />
              <p className="text-muted-foreground font-medium">Sistema inicializando...</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{data.message}</p>
              <p className="text-xs text-muted-foreground mt-3">
                O primeiro snapshot será coletado em instantes. Aguarde alguns minutos e atualize a página.
              </p>
            </div>
          ) : data?.players.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Nenhum jogador em hunt detectado no último snapshot.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-10">#</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Jogador</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Vocação</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Nível</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">XP Ganho</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">XP/hora</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data?.players.map((player, index) => (
                    <tr key={player.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 text-sm text-muted-foreground font-mono">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <PlayerLink name={player.name} className="font-medium text-sm" />
                      </td>
                      <td className={`px-3 py-2.5 text-sm hidden sm:table-cell ${getProfessionColor(player.profession)}`}>
                        {player.profession || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm">
                        {player.level}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-green-400">
                        +{formatXp(player.xpGained)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-accent">
                        {formatXp(player.xpPerHour)}/h
                      </td>
                      <td className="px-3 py-2.5 text-center hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Em Hunt
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Dados inferidos por variação de XP entre snapshots consecutivos (a cada 5 minutos). 
          Fonte: Highscores do servidor.
        </p>
      </div>
    </MainLayout>
  );
};

export default XpActivityPage;
