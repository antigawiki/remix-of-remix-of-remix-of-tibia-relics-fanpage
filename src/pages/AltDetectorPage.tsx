import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Activity, Users, Database } from 'lucide-react';

const AltDetectorPage = () => {
  const [filter, setFilter] = useState('');

  const { data: matches, isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ['alt-matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alt_detector_matches')
        .select('*')
        .order('probability', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: trackerStats } = useQuery({
    queryKey: ['tracker-stats'],
    queryFn: async () => {
      const [sessionsRes, stateRes] = await Promise.all([
        supabase.from('online_tracker_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('online_tracker_state').select('player_name, last_seen_at').order('last_seen_at', { ascending: false }).limit(1),
      ]);
      return {
        totalSessions: sessionsRes.count || 0,
        lastActivity: stateRes.data?.[0]?.last_seen_at || null,
        onlineNow: stateRes.data?.length || 0,
      };
    },
  });

  const { data: onlineCount } = useQuery({
    queryKey: ['online-count-tracker'],
    queryFn: async () => {
      const { count } = await supabase.from('online_tracker_state').select('*', { count: 'exact', head: true });
      return count || 0;
    },
    refetchInterval: 10000,
  });

  const triggerAnalysis = async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-alt-matches`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      refetchMatches();
    } catch (e) {
      console.error('Failed to trigger analysis:', e);
    }
  };

  const filteredMatches = matches?.filter((m) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return m.player_a.toLowerCase().includes(q) || m.player_b.toLowerCase().includes(q);
  });

  const getProbabilityColor = (prob: number) => {
    if (prob >= 75) return 'destructive';
    if (prob >= 50) return 'default';
    if (prob >= 25) return 'secondary';
    return 'outline';
  };

  return (
    <MainLayout showSidebars={false}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">🔍 Alt Detector</h1>
        <p className="text-muted-foreground">
          Detecta personagens que provavelmente pertencem ao mesmo dono baseado em padrões de login/logout.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessões Registradas</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackerStats?.totalSessions ?? '...'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Agora (Tracker)</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onlineCount ?? '...'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Atividade</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {trackerStats?.lastActivity
                  ? new Date(trackerStats.lastActivity).toLocaleString('pt-BR')
                  : 'Nenhuma'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nome do jogador..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={triggerAnalysis} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Rodar Análise
          </Button>
        </div>

        {/* Matches Table */}
        <Card>
          <CardHeader>
            <CardTitle>Matches Detectados ({filteredMatches?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : !filteredMatches?.length ? (
              <p className="text-muted-foreground">
                Nenhum match encontrado. O tracker precisa coletar dados por algum tempo antes de detectar padrões.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player A</TableHead>
                    <TableHead>Player B</TableHead>
                    <TableHead className="text-center">Coincidências</TableHead>
                    <TableHead className="text-center">Sessões A</TableHead>
                    <TableHead className="text-center">Sessões B</TableHead>
                    <TableHead className="text-center">Probabilidade</TableHead>
                    <TableHead className="text-center">Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatches.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.player_a}</TableCell>
                      <TableCell className="font-medium">{m.player_b}</TableCell>
                      <TableCell className="text-center">{m.match_count}</TableCell>
                      <TableCell className="text-center">{m.total_sessions_a}</TableCell>
                      <TableCell className="text-center">{m.total_sessions_b}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getProbabilityColor(m.probability)}>
                          {m.probability}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {new Date(m.last_updated).toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default AltDetectorPage;
