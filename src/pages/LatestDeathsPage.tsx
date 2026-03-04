import React, { useState, useMemo } from 'react';
import { Skull, RefreshCw, Search, Swords, Bug, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS, es, pl } from 'date-fns/locale';
import MainLayout from '@/layouts/MainLayout';
import PlayerLink from '@/components/PlayerLink';
import { useLatestDeaths } from '@/hooks/useLatestDeaths';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n';

const localeMap: Record<string, typeof ptBR> = { pt: ptBR, en: enUS, es, pl };

type FilterType = 'all' | 'pvp' | 'pve';
type DeathSortKey = 'date' | 'character' | 'level';
type SortDir = 'asc' | 'desc';

const LatestDeathsPage = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<DeathSortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { data, isLoading, isFetching } = useLatestDeaths(100, debouncedSearch);
  const deaths = data?.deaths ?? [];
  const totalCount = data?.totalCount ?? 0;
  const isSearchResult = data?.isSearchResult ?? false;

  // Debounce search to avoid too many queries
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 400);
  };
  const { t, language } = useTranslation();
  const dateLocale = localeMap[language] || ptBR;

  const isPvpDeath = (killers: Array<{ name: string; isPlayer: boolean }>) =>
    killers.some((k) => k.isPlayer);

  const getKillerDisplay = (killers: Array<{ name: string; isPlayer: boolean; relatedPlayerName?: string | null }>) => {
    if (!killers || killers.length === 0) return 'Unknown';
    const mainKiller = killers[0];
    return mainKiller.name;
  };

  const handleSort = (key: DeathSortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    const f = deaths.filter((d) => {
      if (filter === 'pvp' && !isPvpDeath(d.killers)) return false;
      if (filter === 'pve' && isPvpDeath(d.killers)) return false;
      return true;
    });
    return [...f].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = new Date(a.death_timestamp).getTime() - new Date(b.death_timestamp).getTime(); break;
        case 'character': cmp = a.player_name.localeCompare(b.player_name); break;
        case 'level': cmp = a.level - b.level; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [deaths, filter, sortKey, sortDir]);

  const DeathSortHeader = ({ label, sk, className }: { label: string; sk: DeathSortKey; className?: string }) => (
    <TableHead className={`cursor-pointer hover:text-foreground ${className || ''}`} onClick={() => handleSort(sk)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></div>
    </TableHead>
  );

  const filterLabels: Record<FilterType, string> = {
    all: t('pages.latestDeaths.all'),
    pvp: 'PvP',
    pve: 'PvE',
  };

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Skull className="w-5 h-5" />
            {t('pages.latestDeaths.title')}
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('pages.latestDeaths.description')}
          </p>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(['all', 'pvp', 'pve'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-sm border transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {filterLabels[f]}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('pages.latestDeaths.searchPlaceholder')}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {t('pages.latestDeaths.deathCount')
                .replace('{shown}', String(filtered.length))
                .replace('{total}', String(totalCount))}
            </span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">{t('pages.latestDeaths.type')}</TableHead>
                   <DeathSortHeader label={t('pages.latestDeaths.dateTime')} sk="date" />
                   <DeathSortHeader label={t('pages.latestDeaths.character')} sk="character" />
                   <DeathSortHeader label={t('pages.latestDeaths.level')} sk="level" className="text-right" />
                   <TableHead>{t('pages.latestDeaths.deathCause')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((death) => {
                  const pvp = isPvpDeath(death.killers);
                  const killer = getKillerDisplay(death.killers);
                  const killerIsPlayer = death.killers[0]?.isPlayer;

                  return (
                    <TableRow key={death.id}>
                      <TableCell>
                        {pvp ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            <Swords className="w-3 h-3 mr-0.5" />
                            PvP
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Bug className="w-3 h-3 mr-0.5" />
                            PvE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(death.death_timestamp), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
                      </TableCell>
                      <TableCell className="font-medium">
                        <PlayerLink name={death.player_name} />
                      </TableCell>
                      <TableCell className="text-right">{death.level}</TableCell>
                      <TableCell className={`text-sm ${killerIsPlayer ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {killerIsPlayer ? (
                          <PlayerLink name={killer} className="text-destructive" />
                        ) : (
                          killer
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Skull className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{t('pages.latestDeaths.noDeaths')}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('pages.latestDeaths.noDeathsHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default LatestDeathsPage;
