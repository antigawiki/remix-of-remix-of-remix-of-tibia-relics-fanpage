import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Search, RefreshCw, Activity, Users, Database, ShieldCheck, ScanSearch, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Scrape TTL: skip characters scraped successfully within last 4 hours
const SCRAPE_TTL_MS = 4 * 60 * 60 * 1000;
// Delay between requests to avoid rate limiting
const REQUEST_DELAY_MS = 800;

function extractCharsFromNextData(data: unknown): string[] {
  const chars: string[] = [];
  function search(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        const first = obj[0] as Record<string, unknown>;
        if (first && typeof first === 'object' && 'name' in first && 'world' in first) {
          for (const item of obj) {
            const char = item as Record<string, unknown>;
            if (char.name && typeof char.name === 'string') chars.push(char.name);
          }
          return;
        }
      }
      obj.forEach((item) => search(item));
    } else {
      Object.values(obj as Record<string, unknown>).forEach((val) => search(val));
    }
  }
  search(data);
  return chars;
}

function extractCharsFromHtml(html: string, playerName: string): string[] {
  const seen = new Set<string>();
  const chars: string[] = [];

  // Find "Account Information" section and extract chars from the table after it
  const accountInfoIdx = html.search(/Account\s+Information/i);
  const searchFrom = accountInfoIdx !== -1 ? accountInfoIdx : 0;
  const relevantHtml = html.slice(searchFrom);

  const linkRegex = /href="\/characters\/([^"?#]+)"/g;
  let match;
  while ((match = linkRegex.exec(relevantHtml)) !== null) {
    const raw = match[1];
    const charName = decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
    if (charName && !seen.has(charName.toLowerCase())) {
      seen.add(charName.toLowerCase());
      chars.push(charName);
    }
  }

  // Fallback: full page
  if (chars.length === 0) {
    const linkRegex2 = /href="\/characters\/([^"?#]+)"/g;
    while ((match = linkRegex2.exec(html)) !== null) {
      const charName = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
      if (charName && !seen.has(charName.toLowerCase())) {
        seen.add(charName.toLowerCase());
        chars.push(charName);
      }
    }
  }

  if (!seen.has(playerName.toLowerCase())) chars.push(playerName);
  return chars;
}

async function scrapeCharacterFromBrowser(name: string): Promise<{ accountChars: string[]; error?: string }> {
  try {
    const url = `https://www.tibiarelic.com/characters/${encodeURIComponent(name)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (resp.status === 429) return { accountChars: [name], error: 'HTTP 429 - Rate limited' };
    if (!resp.ok) return { accountChars: [name], error: `HTTP ${resp.status}` };

    const html = await resp.text();

    // Try __NEXT_DATA__ first
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const accountChars = extractCharsFromNextData(nextData);
        if (accountChars.length > 0) return { accountChars };
      } catch (_e) { /* fall through */ }
    }

    return { accountChars: extractCharsFromHtml(html, name) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    return { accountChars: [name], error: msg };
  }
}

async function saveScrapedRecords(records: { character_name: string; account_chars: string[]; scrape_error: string | null }[]) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-character-accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records }),
  });
  return res.json();
}

const AltDetectorPage = () => {
  const [filter, setFilter] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch ALL player names with pagination (bypasses 1000-row limit)
  const getAllPlayerNames = async (): Promise<string[]> => {
    const PAGE_SIZE = 1000;
    const allNames = new Set<string>();
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('online_tracker_sessions')
        .select('player_name')
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      data.forEach((r) => allNames.add(r.player_name));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return [...allNames];
  };

  // Fetch ALL scraped accounts with pagination
  const getAllScrapedAccounts = async () => {
    const PAGE_SIZE = 1000;
    const all: { character_name: string; account_chars: string[]; scrape_error: string | null; last_scraped_at: string }[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('character_accounts')
        .select('character_name, account_chars, scrape_error, last_scraped_at')
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as typeof all));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  };

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

  // Fetch accounts with multiple characters (confirmed by account page)
  const { data: accountGroups, isLoading: accountsLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ['account-groups'],
    queryFn: async () => {
      // Read all character_accounts with >1 char (paginated)
      const PAGE_SIZE = 1000;
      const all: { character_name: string; account_chars: string[]; last_scraped_at: string }[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('character_accounts')
          .select('character_name, account_chars, last_scraped_at')
          .gt('account_chars', '{}')
          .range(from, from + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        all.push(...(data as typeof all));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Group by account: same set of chars = same account
      // Key = sorted array of chars joined
      const accountMap = new Map<string, { chars: string[]; scraped_at: string }>();
      for (const row of all) {
        if (!row.account_chars || row.account_chars.length < 2) continue;
        const key = [...row.account_chars].sort().join('|');
        if (!accountMap.has(key)) {
          accountMap.set(key, { chars: row.account_chars, scraped_at: row.last_scraped_at });
        }
      }

      return Array.from(accountMap.values())
        .sort((a, b) => b.chars.length - a.chars.length);
    },
    refetchInterval: 60000,
  });

  const { data: trackerStats, refetch: refetchStats } = useQuery({
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

  // Browser-side scraping: fetch tibiarelic directly from the browser (avoids IP blocks on edge functions)
  const triggerScrape = useCallback(async () => {
    setIsScraping(true);
    setScrapeProgress(null);
    setPendingCount(null);
    try {
      // 1. Get ALL unique player names (paginated)
      const allNames = await getAllPlayerNames();

      // 2. Get ALL already-scraped chars (paginated) — check freshness
      const cutoff = new Date(Date.now() - SCRAPE_TTL_MS).toISOString();
      const alreadyScraped = await getAllScrapedAccounts();

      const freshNames = new Set<string>();
      const erroredNames = new Set<string>();
      for (const r of alreadyScraped) {
        const isRecent = r.last_scraped_at >= cutoff;
        const hasData = r.account_chars && r.account_chars.length > 0;
        const hasError = r.scrape_error !== null;
        if (hasError && r.scrape_error?.includes('429')) {
          erroredNames.add(r.character_name);
        } else if (isRecent && hasData && !hasError) {
          freshNames.add(r.character_name);
        }
      }

      // Process ALL pending — no artificial limit
      const toScrape = allNames
        .filter((n) => !freshNames.has(n))
        .sort((a, b) => (erroredNames.has(a) ? 1 : 0) - (erroredNames.has(b) ? 1 : 0));

      if (toScrape.length === 0) {
        toast({ title: 'Todos os perfis estão atualizados!' });
        setPendingCount(0);
        return;
      }

      setScrapeProgress({ done: 0, total: toScrape.length, current: '' });

      let scraped_count = 0;
      let rateLimited = 0;

      for (let i = 0; i < toScrape.length; i++) {
        const name = toScrape[i];
        setScrapeProgress({ done: i, total: toScrape.length, current: name });

        const result = await scrapeCharacterFromBrowser(name);

        // Save immediately after each character — no batching, no data loss
        await saveScrapedRecords([{
          character_name: name,
          account_chars: result.accountChars,
          scrape_error: result.error || null,
        }]);

        if (result.error?.includes('429')) {
          rateLimited++;
          // Update progress and stop
          setScrapeProgress({ done: i + 1, total: toScrape.length, current: '' });
          const stillPending = toScrape.length - (i + 1);
          setPendingCount(stillPending);
          toast({
            title: 'Rate limit atingido',
            description: `Parou em ${name}. ${stillPending} restantes. Aguarde e clique em Continuar.`,
            variant: 'destructive',
          });
          refetchMatches();
          refetchStats();
          return;
        } else if (!result.error) {
          scraped_count++;
        }

        // Delay between requests
        if (i < toScrape.length - 1) await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      }

      setScrapeProgress({ done: toScrape.length, total: toScrape.length, current: '' });
      setPendingCount(0);

      toast({
        title: 'Scraping concluído!',
        description: `${scraped_count} perfis raspados. ${freshNames.size} já estavam atualizados.`,
      });

      refetchMatches();
      refetchStats();
      refetchAccounts();
    } catch (e) {
      console.error('Scrape error:', e);
      toast({ title: 'Erro no scraping', variant: 'destructive' });
    } finally {
      setIsScraping(false);
      setScrapeProgress(null);
    }
  }, [refetchMatches, refetchStats, refetchAccounts, toast]);

  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await callFunction('analyze-alt-matches');
      toast({
        title: 'Análise concluída',
        description: `${result.confirmed_by_account ?? 0} confirmados por conta, ${result.statistical_matches ?? 0} suspeitos estatísticos.`,
      });
      refetchMatches();
      refetchAccounts();
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
            {pendingCount !== null && pendingCount > 0 ? `Continuar (${pendingCount} restantes)` : 'Raspar Perfis'}
          </Button>
          <Button onClick={triggerAnalysis} variant="outline" size="sm" disabled={isAnalyzing}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Rodar Análise
          </Button>
        </div>

        {/* Scraping progress */}
        {scrapeProgress && (
          <Card>
            <CardContent className="pt-4 pb-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {scrapeProgress.current ? `Raspando: ${scrapeProgress.current}` : 'Iniciando...'}
                </span>
                <span className="font-medium">{scrapeProgress.done}/{scrapeProgress.total}</span>
              </div>
              <Progress value={(scrapeProgress.done / scrapeProgress.total) * 100} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Matches Tabs */}
        <Tabs defaultValue="accounts">
          <TabsList>
            <TabsTrigger value="accounts" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Por Conta
              {accountGroups && accountGroups.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{accountGroups.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="gap-2">
              Pares Confirmados
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

          {/* Tab: Accounts grouped */}
          <TabsContent value="accounts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                  Contas com múltiplos personagens
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Contas onde foram encontrados 2+ personagens na mesma conta via leitura de perfil. Confirmação direta da página do tibiarelic.
                </p>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : !accountGroups || accountGroups.length === 0 ? (
                  <p className="text-muted-foreground">
                    Nenhuma conta com múltiplos personagens encontrada ainda. Clique em <strong>Raspar Perfis</strong> para começar.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {accountGroups
                      .filter(g => {
                        if (!filter) return true;
                        const q = filter.toLowerCase();
                        return g.chars.some(c => c.toLowerCase().includes(q));
                      })
                      .map((group, idx) => (
                        <div key={idx} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {group.chars.length} personagens na mesma conta
                            </span>
                            <Badge variant="destructive" className="text-xs">Confirmado</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {group.chars.map((char, ci) => (
                              <span key={ci} className="bg-muted rounded px-2 py-1 text-sm font-medium">
                                {char}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="confirmed">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                  Pares Confirmados por Conta
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Personagens que aparecem listados na mesma conta no perfil do tibiarelic.com.
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
