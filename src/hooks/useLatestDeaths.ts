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

export function useLatestDeaths(limit = 50) {
  return useQuery({
    queryKey: ['latest-deaths', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_deaths')
        .select('*')
        .order('death_timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as PlayerDeath[];
    },
    refetchInterval: 60000,
  });
}
