import { useQuery } from '@tanstack/react-query';

export interface OnlinePlayer {
  name: string;
  profession: string;
  level: number;
}

const fetchOnlinePlayers = async (): Promise<OnlinePlayer[]> => {
  const response = await fetch('https://api.tibiarelic.com/api/Community/Relic/who-is-online');
  
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
