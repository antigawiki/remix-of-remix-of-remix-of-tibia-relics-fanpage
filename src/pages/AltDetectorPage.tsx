import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Activity, Users, Database, ShieldCheck,
  ScanSearch, AlertTriangle, Crown, Link2, Clock, TrendingUp,
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

function ProbabilityBar({ prob }: { prob: number }) {
  const color =
    prob >= 60 ? 'bg-destructive' :
    prob >= 35 ? 'bg-yellow-500' :
    'bg-muted-foreground';
  const label =
    prob >= 60 ? 'Alto risco' :
    prob >= 35 ? 'Suspeito' :
    'Baixo';
  const variant: 'destructive' | 'default' | 'secondary' =
    prob >= 60 ? 'destructive' :
    prob >= 35 ? 'default' :
    'secondary';

  return (
    <div className="flex flex-col items-end gap-1 min-w-[80px]">
      <Badge variant={variant} className="text-xs font-bold">{prob}%</Badge>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(prob, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
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
          <span className="font-bold text-foreground text-sm">{mainChar}</span>
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
                    <span className="font-semibold text-foreground">{char}</span>
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

/* ─────────────────────────── suspect card ─────────────────────────── */

function SuspectCard({ m }: { m: {
  id: string; player_a: string; player_b: string;
  probability: number; match_count: number;
  total_sessions_a: number; total_sessions_b: number;
  last_updated: string; ever_online_together: boolean;
}}) {
  const prob = Math.round(Number(m.probability));
  const isHigh = prob >= 60;
  const isMed = prob >= 35;

  return (
    <Card className={`overflow-hidden transition-colors ${isHigh ? 'border-destructive/40' : isMed ? 'border-yellow-500/30' : ''}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Left: players */}
          <div className="flex-1 p-4 space-y-2">
            {/* Player A */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="font-bold text-foreground">{m.player_a}</span>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {m.total_sessions_a} sessões
              </span>
            </div>

            {/* Connector */}
            <div className="ml-[3px] flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-px h-4 bg-border ml-[3.5px]" />
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {m.match_count} coincidências de login/logout
              </span>
            </div>

            {/* Player B */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
              <span className="font-bold text-foreground">{m.player_b}</span>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {m.total_sessions_b} sessões
              </span>
            </div>

            {/* Footer metadata */}
            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              {m.ever_online_together && (
                <span className="flex items-center gap-1 text-green-600">
                  <Activity className="h-3 w-3" />
                  Já online juntos
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(m.last_updated).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Right: probability */}
      <div className={`flex flex-col items-center justify-center px-5 py-4 shrink-0 border-t sm:border-t-0 sm:border-l
            ${isHigh ? 'bg-destructive/5' : isMed ? 'bg-accent/30' : 'bg-muted/30'}`}>
            <ProbabilityBar prob={prob} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

const AltDetectorPage = () => {
  const [filter, setFilter] = useState('');

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
              <span>Suspeitos Estatísticos</span>
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
          <TabsContent value="suspected" className="space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Pares com padrões suspeitos de login/logout adjacentes · análise automática a cada 10 min
              </p>
            </div>
            {matchesLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <Card key={i} className="h-24 animate-pulse bg-muted" />
                ))}
              </div>
            ) : filteredSuspected.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  {filter ? `Nenhum resultado para "${filter}"` : 'Nenhum suspeito encontrado. O tracker precisa acumular mais sessões para análise estatística ser precisa.'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredSuspected.map((m) => (
                  <SuspectCard key={m.id} m={m} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default AltDetectorPage;
