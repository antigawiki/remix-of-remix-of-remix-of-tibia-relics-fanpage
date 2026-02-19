import { useQuery } from '@tanstack/react-query';

export interface XpActivityPlayer {
  name: string;
  profession: string;
  level: number;
  experience: number;
  xpGained: number;
  xpPerHour: number;
  isHunting: boolean;
  isNewPlayer: boolean;
}

export interface XpActivityResponse {
  players: XpActivityPlayer[];
  latestAt: string | null;
  previousAt: string | null;
  diffMinutes: number;
  totalTracked: number;
  activeNow: number;
  message?: string;
}

const fetchXpActivity = async (): Promise<XpActivityResponse> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-xp-activity`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch XP activity');
  }

  return response.json();
};

export const useXpActivity = () => {
  return useQuery({
    queryKey: ['xp-activity'],
    queryFn: fetchXpActivity,
    // Refresh every 5 minutes to match snapshot frequency
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
    retry: 2,
  });
};

export const formatXp = (xp: number): string => {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}k`;
  return xp.toLocaleString('pt-BR');
};
