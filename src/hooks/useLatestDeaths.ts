import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlayerDeath {
  id: string;
  player_name: string;
  death_timestamp: string;
  level: number;
  killers: Array<{ name: string; isPlayer: boolean; relatedPlayerName?: string | null }>;
  created_at: string;
}

export function useLatestDeaths(initialLimit = 200) {
  return useQuery({
    queryKey: ['latest-deaths', initialLimit],
    queryFn: async () => {
      const [{ data, error }, { count, error: countError }] = await Promise.all([
        supabase
          .from('player_deaths')
          .select('*')
          .order('death_timestamp', { ascending: false })
          .limit(initialLimit),
        supabase
          .from('player_deaths')
          .select('*', { count: 'exact', head: true }),
      ]);

      if (error) throw error;
      if (countError) throw countError;

      return {
        deaths: (data ?? []) as unknown as PlayerDeath[],
        totalCount: count ?? 0,
      };
    },
    refetchInterval: 60000,
  });
}
