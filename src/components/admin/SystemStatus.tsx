import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, CheckCircle, XCircle, Clock, Users, Search, GitBranch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SystemStats {
  totalPlayers: number;
  scrapedProfiles: number;
  pendingProfiles: number;
  confirmedAlts: number;
  statisticalSuspects: number;
}

interface CronStatus {
  name: string;
  label: string;
  schedule: string;
  lastRun?: string;
  icon: React.ReactNode;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function SystemStatus() {
  const { toast } = useToast();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapeStatus, setScrapeStatus] = useState('');

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      // Paginate to get all distinct player names
      const PAGE_SIZE = 1000;
      const allNames = new Set<string>();
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('online_tracker_sessions')
          .select('player_name')
          .range(from, from + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        data.forEach(r => allNames.add(r.player_name));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const { data: scraped } = await supabase
        .from('character_accounts')
        .select('character_name, account_chars, scrape_error');

      const scrapedOk = (scraped || []).filter(r => !r.scrape_error && r.account_chars?.length > 0);

      const { data: matches } = await supabase
        .from('alt_detector_matches')
        .select('probability');

      const confirmed = (matches || []).filter(m => m.probability >= 95).length;
      const suspects = (matches || []).filter(m => m.probability < 95).length;

      setStats({
        totalPlayers: allNames.size,
        scrapedProfiles: scrapedOk.length,
        pendingProfiles: allNames.size - scrapedOk.length,
        confirmedAlts: confirmed,
        statisticalSuspects: suspects,
      });
    } catch (e) {
      console.error('Failed to fetch stats', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cronJobs: CronStatus[] = [
    {
      name: 'track-online-players',
      label: 'Rastreador Online',
      schedule: 'A cada 1 minuto',
      icon: <Users className="w-4 h-4" />,
    },
    {
      name: 'scrape-character-accounts',
      label: 'Scraper de Perfis',
      schedule: 'A cada 15 minutos',
      icon: <Search className="w-4 h-4" />,
    },
    {
      name: 'analyze-alt-matches',
      label: 'Análise de Alts',
      schedule: 'A cada 10 minutos',
      icon: <GitBranch className="w-4 h-4" />,
    },
  ];

  const forceScrape = async () => {
    if (!stats || stats.pendingProfiles === 0) return;
    setScraping(true);
    setScrapeProgress(0);
    setScrapeStatus('Buscando perfis pendentes...');

    try {
      // Get all player names
      const PAGE_SIZE = 1000;
      const allNames = new Set<string>();
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('online_tracker_sessions')
          .select('player_name')
          .range(from, from + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        data.forEach(r => allNames.add(r.player_name));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Get fresh ones
      const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: freshData } = await supabase
        .from('character_accounts')
        .select('character_name')
        .gte('last_scraped_at', cutoff)
        .is('scrape_error', null);

      const freshSet = new Set((freshData || []).map(r => r.character_name));
      const pending = [...allNames].filter(n => !freshSet.has(n));

      if (pending.length === 0) {
        toast({ title: 'Tudo atualizado!', description: 'Nenhum perfil pendente.' });
        setScraping(false);
        return;
      }

      // Process batch of 20 from browser
      const BATCH = 20;
      const batch = pending.slice(0, BATCH);
      const records: { character_name: string; account_chars: string[]; scrape_error: string | null }[] = [];

      for (let i = 0; i < batch.length; i++) {
        const name = batch[i];
        setScrapeStatus(`Processando ${i + 1}/${batch.length}: ${name}`);
        setScrapeProgress(Math.round(((i + 1) / batch.length) * 100));

        try {
          // Try JSON API first via proxy (avoids CORS issues)
          const apiResp = await fetch(
            `${SUPABASE_URL}/functions/v1/tibia-relic-proxy?endpoint=character-api&name=${encodeURIComponent(name)}`,
            { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
          );

          if (apiResp.ok) {
            const apiData = await apiResp.json();
            const chars = extractCharsFromApiData(apiData, name);
            if (chars.length > 0) {
              records.push({ character_name: name, account_chars: chars, scrape_error: null });
              continue;
            }
          }

          // Fallback: direct fetch (browser-side, bypasses server IP blocks)
          const htmlResp = await fetch(`https://www.tibiarelic.com/characters/${encodeURIComponent(name)}`);
          if (htmlResp.ok) {
            const html = await htmlResp.text();
            const chars = extractCharsFromHtml(html, name);
            records.push({ character_name: name, account_chars: chars, scrape_error: null });
          } else {
            records.push({ character_name: name, account_chars: [name], scrape_error: `HTTP ${htmlResp.status}` });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown';
          records.push({ character_name: name, account_chars: [name], scrape_error: msg });
        }

        // Save every 5 records
        if (records.length > 0 && records.length % 5 === 0) {
          await saveRecords(records.slice(-5));
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }

      // Save remaining
      const unsaved = records.length % 5;
      if (unsaved > 0) {
        await saveRecords(records.slice(-unsaved));
      }

      const successful = records.filter(r => !r.scrape_error).length;
      toast({
        title: 'Raspagem concluída',
        description: `${successful}/${batch.length} perfis processados. ${pending.length - batch.length} ainda pendentes.`,
      });

      await fetchStats();
    } catch (e) {
      toast({ title: 'Erro', description: String(e), variant: 'destructive' });
    } finally {
      setScraping(false);
      setScrapeProgress(0);
      setScrapeStatus('');
    }
  };

  const saveRecords = async (records: { character_name: string; account_chars: string[]; scrape_error: string | null }[]) => {
    const now = new Date().toISOString();
    const upserts = records.map(r => ({
      character_name: r.character_name,
      account_chars: r.account_chars,
      last_scraped_at: now,
      scrape_error: r.scrape_error,
    }));
    await fetch(`${SUPABASE_URL}/functions/v1/save-character-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ records: upserts }),
    });
  };

  const scrapePercent = stats ? Math.round((stats.scrapedProfiles / Math.max(stats.totalPlayers, 1)) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Players únicos', value: stats?.totalPlayers ?? '—', color: 'text-gold' },
          { label: 'Perfis raspados', value: stats ? `${stats.scrapedProfiles} (${scrapePercent}%)` : '—', color: 'text-green-400' },
          { label: 'Pendentes', value: stats?.pendingProfiles ?? '—', color: 'text-yellow-400' },
          { label: 'Alts confirmados', value: stats?.confirmedAlts ?? '—', color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-background/50 border border-border rounded p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso da raspagem</span>
            <span>{scrapePercent}%</span>
          </div>
          <Progress value={scrapePercent} className="h-2" />
        </div>
      )}

      {/* Cron Jobs Status */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Processos Automáticos</h3>
        {cronJobs.map((job) => (
          <div key={job.name} className="flex items-center gap-3 bg-background/50 border border-border rounded p-3">
            <div className="text-primary">{job.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{job.label}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {job.schedule}
              </div>
            </div>
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <CheckCircle className="w-3 h-3" />
              Ativo
            </div>
          </div>
        ))}
      </div>

      {/* Force Scrape */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Raspagem Manual</h3>
        <div className="bg-background/50 border border-border rounded p-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Processa um lote de até 20 perfis pendentes diretamente pelo seu navegador (contorna bloqueios de IP do servidor).
            {stats && stats.pendingProfiles > 0 && (
              <span className="text-yellow-400"> {stats.pendingProfiles} perfis aguardando.</span>
            )}
          </p>

          {scraping && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{scrapeStatus}</div>
              <Progress value={scrapeProgress} className="h-2" />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={forceScrape}
              disabled={scraping || !stats || stats.pendingProfiles === 0}
              className="retro-btn flex items-center gap-2 text-sm"
            >
              {scraping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {scraping ? 'Raspando...' : stats && stats.pendingProfiles > 0 ? `Processar (${stats.pendingProfiles} pendentes)` : 'Tudo atualizado'}
            </Button>
            <Button
              onClick={fetchStats}
              variant="outline"
              size="sm"
              disabled={loadingStats}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ----

function extractCharsFromApiData(data: unknown, playerName: string): string[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;

  for (const key of ['accountCharacters', 'characters']) {
    if (Array.isArray(obj[key])) {
      const chars = (obj[key] as { name?: string }[]).filter(c => c.name).map(c => c.name!);
      if (chars.length > 0) return chars;
    }
  }

  // Deep search for {name, world} arrays
  return deepSearchCharArray(data, playerName);
}

function deepSearchCharArray(data: unknown, playerName: string): string[] {
  const chars: string[] = [];

  function search(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        const first = obj[0] as Record<string, unknown>;
        if (first && 'name' in first && 'world' in first) {
          for (const item of obj) {
            const c = item as Record<string, unknown>;
            if (c.name && typeof c.name === 'string') chars.push(c.name);
          }
          return;
        }
      }
      obj.forEach(search);
    } else {
      Object.values(obj as Record<string, unknown>).forEach(search);
    }
  }

  search(data);
  return chars.length > 0 ? chars : [playerName];
}

function extractCharsFromHtml(html: string, playerName: string): string[] {
  // Try __NEXT_DATA__ first
  const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextMatch) {
    try {
      const chars = deepSearchCharArray(JSON.parse(nextMatch[1]), playerName);
      if (chars.length > 1) return chars;
    } catch (_) {}
  }

  // HTML link extraction
  const accountInfoIdx = html.search(/Account\s+Information/i);
  const searchHtml = accountInfoIdx !== -1 ? html.slice(accountInfoIdx) : html;
  const chars: string[] = [];
  const seen = new Set<string>();
  const re = /href="\/characters\/([^"?#]+)"/g;
  let m;
  while ((m = re.exec(searchHtml)) !== null) {
    const name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      chars.push(name);
    }
  }
  if (!seen.has(playerName.toLowerCase())) chars.push(playerName);
  return chars.length > 0 ? chars : [playerName];
}
