import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Clock, User } from 'lucide-react';
import { useState, useMemo } from 'react';

const ADJACENCY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const PAIR_COLORS = [
  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
];

function formatDuration(loginAt: string, logoutAt: string | null): string {
  if (!logoutAt) return 'Online';
  const ms = new Date(logoutAt).getTime() - new Date(loginAt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Session {
  id: string;
  player_name: string;
  login_at: string;
  logout_at: string | null;
}

interface Match {
  id: string;
  player_a: string;
  player_b: string;
  probability: number;
  match_count: number;
  ever_online_together: boolean;
}

const AltPlayerSessionsPage = () => {
  const { playerName } = useParams<{ playerName: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(playerName || '');
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());

  // Fetch matches for this player
  const { data: matches } = useQuery({
    queryKey: ['player-matches', decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alt_detector_matches')
        .select('*')
        .or(`player_a.eq.${decodedName},player_b.eq.${decodedName}`)
        .order('probability', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
    enabled: !!decodedName,
  });

  // Get pair names
  const pairNames = useMemo(() => {
    if (!matches) return [];
    return matches.map(m => m.player_a === decodedName ? m.player_b : m.player_a);
  }, [matches, decodedName]);

  const pairColorMap = useMemo(() => {
    const map = new Map<string, string>();
    pairNames.forEach((name, i) => map.set(name, PAIR_COLORS[i % PAIR_COLORS.length]));
    return map;
  }, [pairNames]);

  // Fetch sessions for player + all pairs
  const allPlayers = useMemo(() => [decodedName, ...pairNames], [decodedName, pairNames]);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['player-sessions', allPlayers],
    queryFn: async () => {
      if (allPlayers.length === 0) return [];
      const PAGE_SIZE = 1000;
      const all: Session[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('online_tracker_sessions')
          .select('id, player_name, login_at, logout_at')
          .in('player_name', allPlayers)
          .order('login_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        all.push(...(data as Session[]));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: allPlayers.length > 0 && pairNames.length > 0,
  });

  // Split sessions
  const playerSessions = useMemo(() => 
    (sessions || []).filter(s => s.player_name === decodedName),
    [sessions, decodedName]
  );

  const pairSessions = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of (sessions || [])) {
      if (s.player_name === decodedName) continue;
      if (!map.has(s.player_name)) map.set(s.player_name, []);
      map.get(s.player_name)!.push(s);
    }
    return map;
  }, [sessions, decodedName]);

  // For each player session, find adjacent pair sessions
  const sessionsWithCoincidences = useMemo(() => {
    const activePairs = selectedPairs.size > 0 ? selectedPairs : new Set(pairNames);

    return playerSessions.map(ps => {
      const loginTime = new Date(ps.login_at).getTime();
      const logoutTime = ps.logout_at ? new Date(ps.logout_at).getTime() : Date.now();

      const coincidences: { name: string; session: Session; type: 'login' | 'logout' | 'both' }[] = [];

      for (const pairName of activePairs) {
        const pSessions = pairSessions.get(pairName) || [];
        for (const pairS of pSessions) {
          const pLogin = new Date(pairS.login_at).getTime();
          const pLogout = pairS.logout_at ? new Date(pairS.logout_at).getTime() : Date.now();

          const loginAdjacent = Math.abs(pLogin - logoutTime) <= ADJACENCY_WINDOW_MS || Math.abs(pLogin - loginTime) <= ADJACENCY_WINDOW_MS;
          const logoutAdjacent = pairS.logout_at && (Math.abs(pLogout - loginTime) <= ADJACENCY_WINDOW_MS || Math.abs(pLogout - logoutTime) <= ADJACENCY_WINDOW_MS);

          if (loginAdjacent || logoutAdjacent) {
            coincidences.push({
              name: pairName,
              session: pairS,
              type: loginAdjacent && logoutAdjacent ? 'both' : loginAdjacent ? 'login' : 'logout',
            });
          }
        }
      }

      return { ...ps, coincidences };
    });
  }, [playerSessions, pairSessions, pairNames, selectedPairs]);

  const togglePair = (name: string) => {
    setSelectedPairs(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <MainLayout showSidebars={false}>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">{decodedName}</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Sessões de login/logout comparadas com pares suspeitos · janela de ±5 min
            </p>
          </div>
        </div>

        {/* Pair chips */}
        {pairNames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Filtrar pares:</span>
            {pairNames.map(name => {
              const match = matches?.find(m => (m.player_a === decodedName ? m.player_b : m.player_a) === name);
              const prob = match ? Math.round(Number(match.probability)) : 0;
              const active = selectedPairs.size === 0 || selectedPairs.has(name);
              const colorClass = pairColorMap.get(name) || PAIR_COLORS[0];
              return (
                <button
                  key={name}
                  onClick={() => togglePair(name)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer
                    ${active ? colorClass : 'bg-muted/30 text-muted-foreground border-transparent opacity-50'}`}
                >
                  {name}
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{prob}%</Badge>
                </button>
              );
            })}
          </div>
        )}

        {/* Sessions table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i} className="h-12 animate-pulse bg-muted" />
            ))}
          </div>
        ) : playerSessions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Nenhuma sessão encontrada para este jogador.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Login</TableHead>
                  <TableHead>Logout</TableHead>
                  <TableHead className="text-center">Duração</TableHead>
                  <TableHead>Coincidências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsWithCoincidences.map(s => (
                  <TableRow key={s.id} className={s.coincidences.length > 0 ? 'bg-primary/5' : ''}>
                    <TableCell className="text-sm whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatTime(s.login_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {s.logout_at ? formatTime(s.logout_at) : (
                        <Badge variant="default" className="text-[10px]">Online</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {formatDuration(s.login_at, s.logout_at)}
                    </TableCell>
                    <TableCell>
                      {s.coincidences.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.coincidences.map((c, ci) => {
                            const colorClass = pairColorMap.get(c.name) || PAIR_COLORS[0];
                            return (
                              <span
                                key={ci}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}
                              >
                                {c.name}
                                <span className="opacity-70">
                                  {c.type === 'login' ? '↗' : c.type === 'logout' ? '↙' : '↕'}
                                  {' '}{formatTime(c.session.login_at)}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default AltPlayerSessionsPage;
