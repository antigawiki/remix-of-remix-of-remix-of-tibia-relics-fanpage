import { Skull, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MainLayout from '@/layouts/MainLayout';
import PlayerLink from '@/components/PlayerLink';
import { useBans, getBanReasonDisplayName } from '@/hooks/useBans';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const DeathRowPage = () => {
  const { data: bans, isLoading, isError, isFetching } = useBans();

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Skull className="w-5 h-5" />
            Banidos
            {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Lista de contas permanentemente banidas em Relic. Cada entrada mostra apenas o 
            personagem de maior level da conta banida. Os banimentos são atualizados uma vez 
            por dia no server save.
          </p>

          {/* Ban count */}
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-destructive" />
            <span className="text-sm">
              <span className="font-semibold text-destructive">{bans?.length ?? 0}</span>
              {' '}conta{(bans?.length ?? 0) !== 1 ? 's' : ''} banida{(bans?.length ?? 0) !== 1 ? 's' : ''}
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
              Erro ao carregar banimentos. Tente novamente mais tarde.
            </div>
          ) : bans && bans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Personagem</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bans.map((ban, index) => (
                  <TableRow key={`${ban.characterName}-${index}`}>
                    <TableCell className="text-muted-foreground">
                      {bans.length - index}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ban.issued), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      <PlayerLink name={ban.characterName} />
                    </TableCell>
                    <TableCell className="text-right">{ban.characterLevel}</TableCell>
                    <TableCell className="text-destructive text-sm">
                      {getBanReasonDisplayName(ban.reason)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Skull className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                Nenhum banimento registrado
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Relic está livre de trapaceiros! 🎉
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default DeathRowPage;
