import { useState, useMemo } from 'react';
import { Users, RefreshCw, ArrowUpDown } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';
import { getVocationDisplayName } from '@/hooks/useHighscores';
import PlayerLink from '@/components/PlayerLink';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n';

type SortKey = 'name' | 'vocation' | 'level';
type SortDir = 'asc' | 'desc';

const OnlinePlayersPage = () => {
  const { data: players, isLoading, isError, isFetching } = useOnlinePlayers();
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>('level');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedPlayers = useMemo(() => {
    if (!players) return [];
    return [...players].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'vocation': cmp = (a.profession || '').localeCompare(b.profession || ''); break;
        case 'level': cmp = a.level - b.level; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [players, sortKey, sortDir]);

  const SortHeader = ({ label, sk, className }: { label: string; sk: SortKey; className?: string }) => (
    <TableHead className={`cursor-pointer hover:text-foreground ${className || ''}`} onClick={() => handleSort(sk)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></div>
    </TableHead>
  );

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('pages.online.title')}
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          {/* Player count */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm">
              <span className="font-semibold text-gold">{players?.length ?? 0}</span>
              {' '}{t('pages.online.playerCount').replace('{count}', '').trim()}
            </span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive">
              {t('common.error')}
            </div>
          ) : players && players.length > 0 ? (
            <Table>
              <TableHeader>
                 <TableRow>
                   <SortHeader label={t('common.name')} sk="name" />
                   <SortHeader label={t('common.vocation')} sk="vocation" />
                   <SortHeader label={t('common.level')} sk="level" className="text-right" />
                 </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player, index) => (
                  <TableRow key={`${player.name}-${index}`}>
                    <TableCell className="font-medium">
                      <PlayerLink name={player.name} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getVocationDisplayName(player.profession)}
                    </TableCell>
                    <TableCell className="text-right">{player.level}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {t('pages.online.noPlayers')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('pages.online.autoUpdate')}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-right">
            {t('pages.online.autoUpdate')}
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default OnlinePlayersPage;
