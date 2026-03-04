import { useState, useMemo } from 'react';
import { Trophy, RefreshCw, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS, es, pl } from 'date-fns/locale';
import PlayerLink from '@/components/PlayerLink';
import { useTranslation } from '@/i18n';
import MainLayout from '@/layouts/MainLayout';
import { 
  useHighscores, 
  categoryDisplayNames, 
  vocationDisplayNames,
  getVocationDisplayName,
  type HighscoreCategory,
  type HighscoreVocation
} from '@/hooks/useHighscores';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const categories: HighscoreCategory[] = [
  'Experience',
  'MagicLevel',
  'FistFighting',
  'ClubFighting',
  'SwordFighting',
  'AxeFighting',
  'DistanceFighting',
  'Shielding',
  'Fishing',
];

const vocations: HighscoreVocation[] = [
  'All',
  'None',
  'Knights',
  'Paladins',
  'Sorcerers',
  'Druids',
];

type HsSortKey = 'name' | 'vocation' | 'level' | 'score';
type SortDir = 'asc' | 'desc';

const HighscoresPage = () => {
  const { t, language } = useTranslation();
  const [category, setCategory] = useState<HighscoreCategory>('Experience');
  const [vocation, setVocation] = useState<HighscoreVocation>('All');
  const [sortKey, setSortKey] = useState<HsSortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  const { data, isLoading, isError, isFetching } = useHighscores(category, vocation);

  const handleSort = (key: HsSortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedHighscores = useMemo(() => {
    if (!data?.highscores) return [];
    return [...data.highscores].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'vocation': cmp = (a.profession || '').localeCompare(b.profession || ''); break;
        case 'level': cmp = a.level - b.level; break;
        case 'score': cmp = a.skillLevel - b.skillLevel; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data?.highscores, sortKey, sortDir]);

  const HsSortHeader = ({ label, sk, className }: { label: string; sk: HsSortKey; className?: string }) => (
    <TableHead className={`cursor-pointer hover:text-foreground ${className || ''}`} onClick={() => handleSort(sk)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></div>
    </TableHead>
  );

  const getDateLocale = () => {
    switch (language) {
      case 'en': return enUS;
      case 'es': return es;
      case 'pl': return pl;
      default: return ptBR;
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-gold font-bold';
    if (rank === 2) return 'text-gray-400 font-bold';
    if (rank === 3) return 'text-amber-600 font-bold';
    return 'text-muted-foreground';
  };

  const getScoreLabel = () => {
    if (category === 'Experience') return t('pages.highscores.scoreLabels.experience');
    if (category === 'MagicLevel') return t('pages.highscores.scoreLabels.magicLevel');
    return t('pages.highscores.scoreLabels.skill');
  };

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {t('pages.highscores.title')}
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('pages.highscores.category')}</label>
              <Select value={category} onValueChange={(v) => setCategory(v as HighscoreCategory)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryDisplayNames[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('pages.highscores.vocation')}</label>
              <Select value={vocation} onValueChange={(v) => setVocation(v as HighscoreVocation)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vocations.map((voc) => (
                    <SelectItem key={voc} value={voc}>
                      {vocationDisplayNames[voc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive">
              {t('pages.highscores.errorLoading')}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                     <HsSortHeader label={t('pages.highscores.columns.name')} sk="name" />
                     <HsSortHeader label={t('pages.highscores.columns.vocation')} sk="vocation" />
                     <HsSortHeader label={t('pages.highscores.columns.level')} sk="level" className="text-right" />
                     <HsSortHeader label={getScoreLabel()} sk="score" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHighscores.map((player, index) => (
                    <TableRow key={`${player.name}-${index}`}>
                      <TableCell className={getRankColor(index + 1)}>
                        #{index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        <PlayerLink name={player.name} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getVocationDisplayName(player.profession)}
                      </TableCell>
                      <TableCell className="text-right">{player.level}</TableCell>
                      <TableCell className="text-right text-gold">
                        {player.skillLevel.toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {sortedHighscores.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('pages.highscores.noPlayers')}
                </div>
              )}
            </>
          )}

          {/* Last updated */}
          {data?.lastUpdatedUtc && (
            <p className="text-xs text-muted-foreground text-right">
              {t('pages.highscores.lastUpdated')}: {format(new Date(data.lastUpdatedUtc), "dd/MM/yyyy HH:mm", { locale: getDateLocale() })}
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default HighscoresPage;
