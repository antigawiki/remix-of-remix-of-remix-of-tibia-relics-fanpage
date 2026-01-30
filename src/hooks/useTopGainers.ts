import { useQuery } from '@tanstack/react-query';

export interface TopGainer {
  rank: number;
  name: string;
  profession: string;
  level: number;
  experienceGained: number;
  currentExperience: number;
  isNewPlayer: boolean;
}

export interface TopGainersResponse {
  gainers: TopGainer[];
  periodStart: string | null;
  periodEnd: string | null;
  message?: string;
}

const fetchTopGainers = async (limit: number = 10): Promise<TopGainersResponse> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-top-gainers?limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch top gainers');
  }
  
  return response.json();
};

export const useTopGainers = (limit: number = 10) => {
  return useQuery({
    queryKey: ['top-gainers', limit],
    queryFn: () => fetchTopGainers(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });
};

// Trigger manual snapshot save (for admin/testing)
export const triggerSnapshotSave = async (): Promise<{ success: boolean; message?: string }> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-highscores`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  return response.json();
};

// Format experience with thousands separator
export const formatExperience = (exp: number): string => {
  return exp.toLocaleString('pt-BR');
};
