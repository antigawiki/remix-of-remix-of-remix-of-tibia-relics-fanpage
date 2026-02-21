import { useState, useMemo } from 'react';
import { Target, Search, ArrowUpDown } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { useKillStatistics, KillStatEntry } from '@/hooks/useKillStatistics';
import { creatures } from '@/data/creatures';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/i18n';

// Build case-insensitive lookup map for creature images
const creatureImageMap = new Map<string, string>();
creatures.forEach((c) => {
  creatureImageMap.set(c.name.toLowerCase(), c.image);
});

type SortKey = keyof KillStatEntry;
type SortDir = 'asc' | 'desc';

const KillStatisticsPage = () => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('overallKilledByPlayers');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { data: stats, isLoading } = useKillStatistics();
  const { t } = useTranslation();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    if (!stats || !Array.isArray(stats)) return [];
    let list = stats;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((e) => e.raceName.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [stats, search, sortKey, sortDir]);

  const SortHeader = ({ label, colKey, className }: { label: string; colKey: SortKey; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className ?? ''}`}
      onClick={() => handleSort(colKey)}
    >
      <span className="flex items-center gap-1 whitespace-nowrap">
        {label}
        {sortKey === colKey && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </TableHead>
  );

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Target className="w-5 h-5" />
            {t('navigation.killStatistics')}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('pages.killStatistics.description')}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('tables.searchCreature')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} {t('pages.killStatistics.creatures')}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label={t('pages.killStatistics.race')} colKey="raceName" />
                    <TableHead className="text-center" colSpan={2}>
                      {t('pages.killStatistics.lastDay')}
                    </TableHead>
                    <TableHead className="text-center" colSpan={2}>
                      {t('pages.killStatistics.lastWeek')}
                    </TableHead>
                    <TableHead className="text-center" colSpan={2}>
                      {t('pages.killStatistics.overall')}
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead />
                    <SortHeader label={t('pages.killStatistics.killedPlayers')} colKey="lastDayKilledPlayers" className="text-center text-destructive" />
                    <SortHeader label={t('pages.killStatistics.killedByPlayers')} colKey="lastDayKilledByPlayers" className="text-center" />
                    <SortHeader label={t('pages.killStatistics.killedPlayers')} colKey="lastWeekKilledPlayers" className="text-center text-destructive" />
                    <SortHeader label={t('pages.killStatistics.killedByPlayers')} colKey="lastWeekKilledByPlayers" className="text-center" />
                    <SortHeader label={t('pages.killStatistics.killedPlayers')} colKey="overallKilledPlayers" className="text-center text-destructive" />
                    <SortHeader label={t('pages.killStatistics.killedByPlayers')} colKey="overallKilledByPlayers" className="text-center" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => {
                    const img = creatureImageMap.get(entry.raceName.toLowerCase());
                    return (
                      <TableRow key={entry.raceName}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {img ? (
                              <img src={img} alt={entry.raceName} className="w-8 h-8 object-contain" loading="lazy" />
                            ) : (
                              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">?</div>
                            )}
                            <span className="capitalize">{entry.raceName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-destructive">{entry.lastDayKilledPlayers || '-'}</TableCell>
                        <TableCell className="text-center text-emerald-500">{entry.lastDayKilledByPlayers || '-'}</TableCell>
                        <TableCell className="text-center text-destructive">{entry.lastWeekKilledPlayers || '-'}</TableCell>
                        <TableCell className="text-center text-emerald-500">{entry.lastWeekKilledByPlayers || '-'}</TableCell>
                        <TableCell className="text-center text-destructive">{entry.overallKilledPlayers || '-'}</TableCell>
                        <TableCell className="text-center text-emerald-500">{entry.overallKilledByPlayers || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default KillStatisticsPage;
