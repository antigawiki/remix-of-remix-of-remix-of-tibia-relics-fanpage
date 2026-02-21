import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import {
  Search, Activity, Users, Database, ShieldCheck,
  ScanSearch, AlertTriangle, Crown, Link2, Clock, Eye,
} from 'lucide-react';

/* ─────────────────────────── helpers ─────────────────────────── */

const professionColor: Record<string, string> = {
  'Knight': 'text-red-500',
  'Elite Knight': 'text-red-500',
  'Paladin': 'text-green-500',
  'Royal Paladin': 'text-green-500',
  'Sorcerer': 'text-blue-500',
  'Master Sorcerer': 'text-blue-500',
  'Druid': 'text-emerald-500',
  'Elder Druid': 'text-emerald-500',
};

const professionShort: Record<string, string> = {
  'Knight': 'EK', 'Elite Knight': 'EK',
  'Paladin': 'RP', 'Royal Paladin': 'RP',
  'Sorcerer': 'MS', 'Master Sorcerer': 'MS',
  'Druid': 'ED', 'Elder Druid': 'ED',
};

function ProfBadge({ profession }: { profession: string }) {
  const short = professionShort[profession] ?? profession.slice(0, 2).toUpperCase();
  const color = professionColor[profession] ?? 'text-muted-foreground';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider ${color} bg-muted rounded px-1.5 py-0.5`}>
      {short}
    </span>
  );
}


/* ─────────────────────────── stat card ─────────────────────────── */

function StatCard({
  label, value, sub, icon: Icon, accent = false,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <Card className={accent ? 'border-primary/40 bg-primary/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
            <p className="text-2xl font-bold mt-1 leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg shrink-0 ${accent ? 'bg-primary/20' : 'bg-muted'}`}>
            <Icon className={`h-4 w-4 ${accent ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── account card ─────────────────────────── */

function AccountGroupCard({
  group,
  levelMap,
  resolveMainChar,
  idx,
}: {
  group: { chars: string[]; scraped_at: string };
  levelMap: Map<string, { level: number; profession: string }> | undefined;
  resolveMainChar: (chars: string[]) => string;
  idx: number;
}) {
  const mainChar = resolveMainChar(group.chars);
  const mainData = levelMap?.get(mainChar);
  const altChars = group.chars.filter(c => c !== mainChar);

  return (
    <Card className="overflow-hidden hover:border-primary/40 transition-colors">
      {/* MAIN row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-primary/8 border-b">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 shrink-0">
          <Crown className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 shrink-0">
            MAIN
          </Badge>
          <Link to={`/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3/${encodeURIComponent(mainChar)}`} className="font-bold text-foreground text-sm hover:text-primary hover:underline transition-colors">{mainChar}</Link>
          {mainData && (
            <>
              <span className="text-sm font-semibold text-muted-foreground">Lv.{mainData.level}</span>
              <ProfBadge profession={mainData.profession} />
            </>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          <Link2 className="h-3 w-3" />
          {group.chars.length} chars
        </div>
      </div>

      {/* ALTs row */}
      {altChars.length > 0 && (
        <CardContent className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {altChars
              .sort((a, b) => (levelMap?.get(b)?.level ?? 0) - (levelMap?.get(a)?.level ?? 0))
              .map((char, ci) => {
                const altData = levelMap?.get(char);
                return (
                  <div
                    key={ci}
                    className="inline-flex items-center gap-1.5 bg-muted/60 border rounded-full px-3 py-1 text-xs hover:bg-muted transition-colors"
                  >
                    <span className="text-muted-foreground font-medium">alt</span>
                    <Link to={`/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3/${encodeURIComponent(char)}`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors">{char}</Link>
                    {altData && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">Lv.{altData.level}</span>
                        <ProfBadge profession={altData.profession} />
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}


/* ─────────────────────────── page ─────────────────────────── */

const AltDetectorPage = () => {
  const [filter, setFilter] = useState('');
  const [includeSeenTogether, setIncludeSeenTogether] = useState(true);

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

  const resolveMainChar = (chars: string[]): string => {
    if (!levelMap || levelMap.size === 0) return chars[0];
    let main = chars[0];
    let maxLevel = levelMap.get(chars[0])?.level ?? 0;
    for (const c of chars) {
      const lv = levelMap.get(c)?.level ?? 0;
      if (lv > maxLevel) { maxLevel = lv; main = c; }
    }
    return main;
  };

  const filteredAccounts = (accountGroups ?? []).filter(g => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return g.chars.some(c => c.toLowerCase().includes(q));
  });

  const filteredSuspected = (matches ?? []).filter(m => {
    if (!includeSeenTogether && m.ever_online_together) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return m.player_a.toLowerCase().includes(q) || m.player_b.toLowerCase().includes(q);
  });

  const lastActivityStr = trackerStats?.lastActivity
    ? `Atualizado ${new Date(trackerStats.lastActivity).toLocaleTimeString('pt-BR')}`
    : undefined;

  return (
    <MainLayout showSidebars={false}>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Alt Detector</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Detecta alts via API de conta e análise estatística de padrões de login/logout · tracker 24h a cada 5s
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Sessões" value={trackerStats?.totalSessions?.toLocaleString('pt-BR') ?? '…'} icon={Database} />
          <StatCard label="Jogadores únicos" value={trackerStats?.uniquePlayers ?? '…'} icon={Users} />
          <StatCard label="Perfis coletados" value={trackerStats?.scrapedProfiles ?? '…'} sub={`de ${trackerStats?.uniquePlayers ?? '?'} únicos`} icon={ScanSearch} />
          <StatCard
            label="Online agora"
            value={onlineCount ?? '…'}
            sub={lastActivityStr}
            icon={Activity}
            accent
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Filtrar por nome do personagem…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 max-w-sm"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList className="h-auto p-1 gap-1">
            <TabsTrigger value="accounts" className="gap-2 px-4 py-2">
              <Crown className="h-4 w-4" />
              <span>Alts por Conta</span>
              {filteredAccounts.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1.5">{filteredAccounts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suspected" className="gap-2 px-4 py-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Suspeitos</span>
              {filteredSuspected.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{filteredSuspected.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Alts por Conta ── */}
          <TabsContent value="accounts" className="space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Grupos confirmados via API · personagem de maior level destacado como <strong>MAIN</strong> · cron automático a cada 15 min
              </p>
            </div>
            {accountsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <Card key={i} className="h-20 animate-pulse bg-muted" />
                ))}
              </div>
            ) : filteredAccounts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  {filter ? `Nenhum resultado para "${filter}"` : 'Nenhuma conta com múltiplos personagens encontrada ainda. O sistema coleta automaticamente a cada 15 minutos.'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredAccounts.map((group, idx) => (
                  <AccountGroupCard
                    key={idx}
                    idx={idx}
                    group={group}
                    levelMap={levelMap}
                    resolveMainChar={resolveMainChar}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Suspeitos ── */}
          <TabsContent value="suspected" className="mt-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                Pares com padrões suspeitos de login/logout adjacentes · análise automática a cada 10 min
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id="toggle-seen-together"
                  checked={includeSeenTogether}
                  onCheckedChange={setIncludeSeenTogether}
                />
                <Label htmlFor="toggle-seen-together" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Incluir vistos juntos
                </Label>
              </div>
            </div>
            {matchesLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <Card key={i} className="h-10 animate-pulse bg-muted" />
                ))}
              </div>
            ) : filteredSuspected.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  {filter ? `Nenhum resultado para "${filter}"` : 'Nenhum suspeito encontrado. O tracker precisa acumular mais sessões para análise estatística ser precisa.'}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personagem A</TableHead>
                      <TableHead>Personagem B</TableHead>
                      <TableHead className="text-center">Probabilidade</TableHead>
                      <TableHead className="text-center">Coincidências</TableHead>
                      <TableHead className="text-center">Sessões A</TableHead>
                      <TableHead className="text-center">Sessões B</TableHead>
                      <TableHead className="text-right">Atualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TooltipProvider>
                    {filteredSuspected.map((m) => {
                      const prob = Math.round(Number(m.probability));
                      const isHigh = prob >= 60;
                      const isMed = prob >= 35;
                      const badgeClass = isHigh
                        ? 'bg-destructive text-destructive-foreground'
                        : isMed
                        ? 'bg-yellow-500 text-white'
                        : 'bg-muted text-muted-foreground';
                      const seenTogether = m.ever_online_together;
                      return (
                        <TableRow
                          key={m.id}
                          className={seenTogether ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : ''}
                        >
                          <TableCell className="font-semibold">
                            <Link to={`/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3/${encodeURIComponent(m.player_a)}`} className="hover:text-primary hover:underline transition-colors">
                              {m.player_a}
                            </Link>
                          </TableCell>
                          <TableCell className="font-semibold">
                            <Link to={`/d4f8a2c91b3e7f05a6d2e8b4c7f1a9e3/${encodeURIComponent(m.player_b)}`} className="hover:text-primary hover:underline transition-colors">
                              {m.player_b}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${badgeClass}`}>
                                {prob}%
                              </span>
                              {seenTogether && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-500/15 rounded-full px-1.5 py-0.5 cursor-help">
                                      <Eye className="h-3 w-3" />
                                      Juntos
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px] text-center text-xs">
                                    Estes personagens foram vistos online ao mesmo tempo. A probabilidade foi reduzida proporcionalmente.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm">{m.match_count}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{m.total_sessions_a}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{m.total_sessions_b}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(m.last_updated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    </TooltipProvider>
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default AltDetectorPage;
