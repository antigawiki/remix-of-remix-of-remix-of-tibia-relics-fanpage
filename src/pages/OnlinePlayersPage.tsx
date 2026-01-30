import { Users, RefreshCw } from 'lucide-react';
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

const OnlinePlayersPage = () => {
  const { data: players, isLoading, isError, isFetching } = useOnlinePlayers();

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Jogadores Online
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          {/* Player count */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm">
              <span className="font-semibold text-gold">{players?.length ?? 0}</span>
              {' '}jogador{(players?.length ?? 0) !== 1 ? 'es' : ''} online
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
              Erro ao carregar jogadores online. Tente novamente mais tarde.
            </div>
          ) : players && players.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Vocação</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player, index) => (
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
                Nenhum jogador online no momento
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Os dados são atualizados automaticamente a cada 30 segundos
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-right">
            Atualização automática a cada 30 segundos
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default OnlinePlayersPage;
