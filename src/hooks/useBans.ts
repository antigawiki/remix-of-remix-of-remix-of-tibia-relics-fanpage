import { useQuery } from '@tanstack/react-query';

export interface BanEntry {
  issued: string;
  characterName: string;
  characterLevel: number;
  reason: string;
}

const fetchBans = async (): Promise<BanEntry[]> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tibia-relic-proxy?endpoint=bans`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch bans');
  }
  
  return response.json();
};

export const useBans = () => {
  return useQuery({
    queryKey: ['bans'],
    queryFn: fetchBans,
    staleTime: 5 * 60 * 1000, // 5 minutes - bans update once per day
    retry: 3,
  });
};

// Helper to get display name for ban reason
export const getBanReasonDisplayName = (reason: string): string => {
  const reasonMap: Record<string, string> = {
    'CHEATING_MULTI_CLIENT': 'Multi-clienting',
    'CHEATING_MACRO_USE': 'Uso de macro',
    'CHEATING_BOT_USE': 'Uso de bot',
    'CHEATING': 'Trapaça',
    'HARASSMENT': 'Assédio',
    'SPAM': 'Spam',
    'OFFENSIVE_NAME': 'Nome ofensivo',
    'OFFENSIVE_STATEMENT': 'Declaração ofensiva',
  };
  
  return reasonMap[reason] || reason.replace(/_/g, ' ').toLowerCase();
};
