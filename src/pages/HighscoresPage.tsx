import { useState } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const HighscoresPage = () => {
  const [category, setCategory] = useState<HighscoreCategory>('Experience');
  const [vocation, setVocation] = useState<HighscoreVocation>('All');
  
  const { data, isLoading, isError, isFetching } = useHighscores(category, vocation);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-gold font-bold';
    if (rank === 2) return 'text-gray-400 font-bold';
    if (rank === 3) return 'text-amber-600 font-bold';
    return 'text-muted-foreground';
  };

  const getScoreLabel = () => {
    if (category === 'Experience') return 'Experiência';
    if (category === 'MagicLevel') return 'Magic Level';
    return 'Skill';
  };

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Ranking
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Categoria</label>
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
              <label className="text-xs text-muted-foreground">Vocação</label>
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
              Erro ao carregar ranking. Tente novamente mais tarde.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Vocação</TableHead>
                    <TableHead className="text-right">Level</TableHead>
                    <TableHead className="text-right">{getScoreLabel()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.highscores.map((player, index) => (
                    <TableRow key={`${player.name}-${index}`}>
                      <TableCell className={getRankColor(index + 1)}>
                        #{index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{player.name}</TableCell>
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

              {data?.highscores.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum jogador encontrado para esta categoria/vocação.
                </div>
              )}
            </>
          )}

          {/* Last updated */}
          {data?.lastUpdatedUtc && (
            <p className="text-xs text-muted-foreground text-right">
              Última atualização: {format(new Date(data.lastUpdatedUtc), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default HighscoresPage;
