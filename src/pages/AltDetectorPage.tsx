import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, RefreshCw, Activity, Users, Database, ShieldCheck, ScanSearch, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const AltDetectorPage = () => {
  const [filter, setFilter] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const { toast } = useToast();

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
    refetchInterval: 30000,
  });

  const { data: trackerStats } = useQuery({
    queryKey: ['tracker-stats'],
    queryFn: async () => {
      const [sessionsRes, stateRes, uniqueRes, scrapedRes] = await Promise.all([
        supabase.from('online_tracker_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('online_tracker_state').select('player_name, last_seen_at').order('last_seen_at', { ascending: false }).limit(1),
        supabase.from('online_tracker_sessions').select('player_name'),
        supabase.from('character_accounts').select('character_name', { count: 'exact', head: true }),
      ]);
      const uniquePlayers = new Set((uniqueRes.data || []).map((r: { player_name: string }) => r.player_name)).size;
      return {
        totalSessions: sessionsRes.count || 0,
        lastActivity: stateRes.data?.[0]?.last_seen_at || null,
        uniquePlayers,
        scrapedProfiles: scrapedRes.count || 0,
      };
    },
    refetchInterval: 15000,
  });

  const { data: onlineCount } = useQuery({
    queryKey: ['online-count-tracker'],
    queryFn: async () => {
      const { count } = await supabase.from('online_tracker_state').select('*', { count: 'exact', head: true });
      return count || 0;
    },
    refetchInterval: 10000,
  });

  const callFunction = async (name: string) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  };

  const triggerScrape = async () => {
    setIsScraping(true);
    try {
      const result = await callFunction('scrape-character-accounts');
      if (result.rate_limited > 0 && result.scraped === 0) {
        toast({
          title: 'Rate limit ativo',
          description: `O site está bloqueando requisições no momento (429). Tente novamente em alguns minutos.`,
          variant: 'destructive',
        });
      } else {
        const parts = [];
        if (result.scraped > 0) parts.push(`${result.scraped} raspados`);
        if (result.skipped_fresh > 0) parts.push(`${result.skipped_fresh} já atualizados`);
        if (result.rate_limited > 0) parts.push(`${result.rate_limited} bloqueados (429)`);
        if (result.still_pending > 0) parts.push(`${result.still_pending} pendentes`);
        toast({
          title: 'Scraping concluído',
          description: parts.join(', ') || 'Nenhum perfil processado.',
        });
      }
      refetchMatches();
    } catch (e) {
      toast({ title: 'Erro no scraping', variant: 'destructive' });
    } finally {
      setIsScraping(false);
    }
  };

  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await callFunction('analyze-alt-matches');
      toast({
        title: 'Análise concluída',
        description: `${result.confirmed_by_account ?? 0} confirmados por conta, ${result.statistical_matches ?? 0} suspeitos estatísticos.`,
      });
      refetchMatches();
    } catch (e) {
      toast({ title: 'Erro na análise', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Separate confirmed (99%) vs suspected (<99%)
  const confirmedMatches = matches?.filter((m) => m.probability >= 99) ?? [];
  const suspectedMatches = matches?.filter((m) => m.probability < 99) ?? [];

  const applyFilter = (list: typeof matches) =>
    list?.filter((m) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return m.player_a.toLowerCase().includes(q) || m.player_b.toLowerCase().includes(q);
    }) ?? [];

  const filteredConfirmed = applyFilter(confirmedMatches);
  const filteredSuspected = applyFilter(suspectedMatches);

  const getProbabilityBadge = (prob: number) => {
    if (prob >= 99) return <Badge variant="destructive">✓ Confirmado</Badge>;
    if (prob >= 60) return <Badge variant="destructive">{prob}%</Badge>;
    if (prob >= 35) return <Badge variant="default">{prob}%</Badge>;
    return <Badge variant="secondary">{prob}%</Badge>;
  };

  const MatchTable = ({ rows }: { rows: NonNullable<typeof matches> }) => (
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
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium">{m.player_a}</TableCell>
            <TableCell className="font-medium">{m.player_b}</TableCell>
            <TableCell className="text-center">{m.match_count || '—'}</TableCell>
            <TableCell className="text-center">{m.total_sessions_a || '—'}</TableCell>
            <TableCell className="text-center">{m.total_sessions_b || '—'}</TableCell>
            <TableCell className="text-center">{getProbabilityBadge(m.probability)}</TableCell>
            <TableCell className="text-center text-sm text-muted-foreground">
              {new Date(m.last_updated).toLocaleString('pt-BR')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <MainLayout showSidebars={false}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">🔍 Alt Detector</h1>
          <p className="text-muted-foreground mt-1">
            Detecta alts por leitura de perfis de conta e por análise estatística de padrões de login/logout.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <CardTitle className="text-sm font-medium">Jogadores Únicos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackerStats?.uniquePlayers ?? '...'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Perfis Raspados</CardTitle>
              <ScanSearch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackerStats?.scrapedProfiles ?? '...'}</div>
              <p className="text-xs text-muted-foreground">de {trackerStats?.uniquePlayers ?? '?'} únicos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Agora</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onlineCount ?? '...'}</div>
              <p className="text-xs text-muted-foreground">
                {trackerStats?.lastActivity
                  ? `Último: ${new Date(trackerStats.lastActivity).toLocaleTimeString('pt-BR')}`
                  : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nome do jogador..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={triggerScrape} variant="outline" size="sm" disabled={isScraping}>
            {isScraping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanSearch className="h-4 w-4 mr-2" />}
            Raspar Perfis
          </Button>
          <Button onClick={triggerAnalysis} variant="outline" size="sm" disabled={isAnalyzing}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Rodar Análise
          </Button>
        </div>

        {/* Matches Tabs */}
        <Tabs defaultValue="confirmed">
          <TabsList>
            <TabsTrigger value="confirmed" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Confirmados por Conta
              {confirmedMatches.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{confirmedMatches.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suspected">
              Suspeitos (Estatístico)
              {suspectedMatches.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{suspectedMatches.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confirmed">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                  Alts Confirmados por Página de Conta
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Personagens que aparecem listados na mesma conta no perfil do tibiarelic.com. Certeza praticamente absoluta.
                </p>
              </CardHeader>
              <CardContent>
                {matchesLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : !filteredConfirmed.length ? (
                  <p className="text-muted-foreground">
                    Nenhum alt confirmado ainda. Clique em <strong>Raspar Perfis</strong> para começar a leitura das páginas de conta.
                  </p>
                ) : (
                  <MatchTable rows={filteredConfirmed} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suspected">
            <Card>
              <CardHeader>
                <CardTitle>Suspeitos por Análise Estatística</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pares com padrões suspeitos de login/logout adjacentes. Probabilidade máxima de 80% — menos certo que a leitura de conta.
                </p>
              </CardHeader>
              <CardContent>
                {matchesLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : !filteredSuspected.length ? (
                  <p className="text-muted-foreground">
                    Nenhum suspeito encontrado. O tracker precisa coletar dados por mais tempo.
                  </p>
                ) : (
                  <MatchTable rows={filteredSuspected} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default AltDetectorPage;
