import { useQuery } from '@tanstack/react-query';

export interface OnlinePlayer {
  name: string;
  profession: string;
  level: number;
}

const fetchOnlinePlayers = async (): Promise<OnlinePlayer[]> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tibia-relic-proxy?endpoint=who-is-online`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch online players');
  }
  
  return response.json();
};

export const useOnlinePlayers = () => {
  return useQuery({
    queryKey: ['onlinePlayers'],
    queryFn: fetchOnlinePlayers,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
    retry: 3,
  });
};
