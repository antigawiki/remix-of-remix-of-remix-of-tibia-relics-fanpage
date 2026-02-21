import { useQuery } from '@tanstack/react-query';

export interface KillStatEntry {
  raceName: string;
  lastDayKilledPlayers: number;
  lastDayKilledByPlayers: number;
  lastWeekKilledPlayers: number;
  lastWeekKilledByPlayers: number;
  overallKilledPlayers: number;
  overallKilledByPlayers: number;
}

export function useKillStatistics() {
  return useQuery({
    queryKey: ['kill-statistics'],
    queryFn: async () => {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(
        `${projectUrl}/functions/v1/tibia-relic-proxy?endpoint=kill-statistics`,
        {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
        }
      );

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      return (result?.entries ?? []) as KillStatEntry[];
    },
    refetchInterval: 300000,
    staleTime: 120000,
  });
}
