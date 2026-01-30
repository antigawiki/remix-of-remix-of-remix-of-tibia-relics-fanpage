import { useQuery } from '@tanstack/react-query';

export interface ServerStats {
  playersOnline: number;
  recordOnline: number;
  recordOnlineDate: string;
  nextServerSave: string;
}

const fetchServerStats = async (): Promise<ServerStats> => {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tibia-relic-proxy?endpoint=stats`,
    {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch server stats');
  }
  
  return response.json();
};

export const useServerStats = () => {
  return useQuery({
    queryKey: ['serverStats'],
    queryFn: fetchServerStats,
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 3,
  });
};
