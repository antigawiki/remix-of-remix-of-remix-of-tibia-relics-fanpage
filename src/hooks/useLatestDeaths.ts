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

async function fetchAllMatching(search: string): Promise<PlayerDeath[]> {
  const all: PlayerDeath[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('player_deaths')
      .select('*')
      .or(`player_name.ilike.%${search}%`)
      .order('death_timestamp', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as unknown as PlayerDeath[]));
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return all;
}

export function useLatestDeaths(initialLimit = 100, search = '') {
  return useQuery({
    queryKey: ['latest-deaths', initialLimit, search],
    queryFn: async () => {
      // When searching, fetch all matching records from DB
      if (search.trim()) {
        const deaths = await fetchAllMatching(search.trim());
        return { deaths, totalCount: deaths.length, isSearchResult: true };
      }

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
        isSearchResult: false,
      };
    },
    refetchInterval: 60000,
  });
}
