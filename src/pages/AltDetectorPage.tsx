import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Activity, Users, Database, ShieldCheck, ScanSearch, Star, Crown } from 'lucide-react';

const AltDetectorPage = () => {
  const [filter, setFilter] = useState('');

  // Fetch account groups (confirmed by account API)
  const { data: accountGroups, isLoading: accountsLoading } = useQuery({
    queryKey: ['account-groups'],
    queryFn: async () => {
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

      // Deduplicate groups by their sorted char set
      const accountMap = new Map<string, { chars: string[]; scraped_at: string }>();
      for (const row of all) {
        if (!row.account_chars || row.account_chars.length < 2) continue;
        const key = [...row.account_chars].sort().join('|');
        if (!accountMap.has(key)) {
          accountMap.set(key, { chars: row.account_chars, scraped_at: row.last_scraped_at });
        }
      }

      return Array.from(accountMap.values()).sort((a, b) => b.chars.length - a.chars.length);
    },
    refetchInterval: 60000,
  });

  // Fetch levels from highscore_snapshots to identify MAIN char
  const { data: levelMap } = useQuery({
    queryKey: ['char-levels'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const map = new Map<string, { level: number; profession: string }>();
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('highscore_snapshots')
          .select('player_name, level, profession')
          .order('snapshot_date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        for (const r of data) {
          if (!map.has(r.player_name) && r.level != null) {
            map.set(r.player_name, { level: r.level, profession: r.profession ?? '' });
          }
        }
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return map;
    },
    refetchInterval: 300000,
  });

  // Fetch suspected matches (statistical, prob < 99%)
  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ['alt-matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alt_detector_matches')
        .select('*')
        .lt('probability', 99)
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

  // Resolve main char (highest level) in a group
  const resolveMainChar = (chars: string[]): string => {
    if (!levelMap || levelMap.size === 0) return chars[0];
    let main = chars[0];
    let maxLevel = levelMap.get(chars[0])?.level ?? 0;
    for (const c of chars) {
      const lv = levelMap.get(c)?.level ?? 0;
      if (lv > maxLevel) {
        maxLevel = lv;
        main = c;
      }
    }
    return main;
  };

  const getProbabilityBadge = (prob: number) => {
    if (prob >= 60) return <Badge variant="destructive">{prob}%</Badge>;
    if (prob >= 35) return <Badge variant="default" className="opacity-90">{prob}%</Badge>;
    return <Badge variant="secondary">{prob}%</Badge>;
  };

  const filteredAccounts = (accountGroups ?? []).filter(g => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return g.chars.some(c => c.toLowerCase().includes(q));
  });

  const filteredSuspected = (matches ?? []).filter(m => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return m.player_a.toLowerCase().includes(q) || m.player_b.toLowerCase().includes(q);
  });

  return (
    <MainLayout showSidebars={false}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">🔍 Alt Detector</h1>
          <p className="text-muted-foreground mt-1">
            Detecta alts por leitura de conta via API e por análise estatística de padrões de login/logout (tracker 24h/5s).
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
              <CardTitle className="text-sm font-medium">Perfis Coletados</CardTitle>
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

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por nome do jogador..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="accounts">
          <TabsList>
            <TabsTrigger value="accounts" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Alts por Conta
              {filteredAccounts.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{filteredAccounts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suspected" className="gap-2">
              <Star className="h-4 w-4" />
              Suspeitos
              {filteredSuspected.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{filteredSuspected.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Accounts grouped with MAIN highlighted */}
          <TabsContent value="accounts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                  Contas com múltiplos personagens
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Grupos confirmados via API de conta. O personagem de maior level aparece em destaque como <strong>MAIN</strong>.
                  Cron automático coleta novos personagens a cada 15 minutos.
                </p>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : filteredAccounts.length === 0 ? (
                  <p className="text-muted-foreground">
                    Nenhuma conta com múltiplos personagens encontrada ainda. O sistema coleta automaticamente a cada 15 minutos.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredAccounts.map((group, idx) => {
                      const mainChar = resolveMainChar(group.chars);
                      const mainData = levelMap?.get(mainChar);
                      const altChars = group.chars.filter(c => c !== mainChar);

                      return (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          {/* MAIN char header */}
                          <div className="bg-primary/10 border-b px-4 py-3 flex items-center gap-3">
                            <Crown className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge className="bg-primary text-primary-foreground text-xs shrink-0">MAIN</Badge>
                              <span className="font-bold text-foreground truncate">{mainChar}</span>
                              {mainData && (
                                <>
                                  <span className="text-sm text-muted-foreground shrink-0">Lv.{mainData.level}</span>
                                  <span className="text-xs text-muted-foreground hidden sm:block truncate">{mainData.profession}</span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{group.chars.length} chars</span>
                          </div>

                          {/* Alt chars */}
                          {altChars.length > 0 && (
                            <div className="px-4 py-3 flex flex-wrap gap-2">
                              {altChars.map((char, ci) => {
                                const altData = levelMap?.get(char);
                                return (
                                  <div
                                    key={ci}
                                    className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-sm"
                                  >
                                    <span className="text-muted-foreground text-xs">alt</span>
                                    <span className="font-medium">{char}</span>
                                    {altData && (
                                      <span className="text-xs text-muted-foreground">Lv.{altData.level}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Statistical suspects */}
          <TabsContent value="suspected">
            <Card>
              <CardHeader>
                <CardTitle>Suspeitos por Análise Estatística</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pares com padrões suspeitos de login/logout adjacentes. Baseado no histórico de sessões do tracker (24h/5s).
                  Análise automática a cada 10 minutos.
                </p>
              </CardHeader>
              <CardContent>
                {matchesLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : filteredSuspected.length === 0 ? (
                  <p className="text-muted-foreground">
                    Nenhum suspeito encontrado. O tracker precisa acumular mais sessões para análise estatística ser precisa.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredSuspected.map((m) => {
                      const probNum = Math.round(Number(m.probability));
                      return (
                        <div key={m.id} className="border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                          {/* Players */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground truncate">{m.player_a}</span>
                                <span className="text-muted-foreground text-xs">({m.total_sessions_a} sessões)</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <span>↕</span>
                                <span>{m.match_count} coincidências de login/logout</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-bold text-foreground truncate">{m.player_b}</span>
                                <span className="text-muted-foreground text-xs">({m.total_sessions_b} sessões)</span>
                              </div>
                            </div>
                          </div>

                          {/* Probability badge */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground mb-1">Probabilidade</div>
                              {getProbabilityBadge(probNum)}
                            </div>
                            <div className="text-right hidden sm:block">
                              <div className="text-xs text-muted-foreground">Atualizado</div>
                              <div className="text-xs">{new Date(m.last_updated).toLocaleString('pt-BR')}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
