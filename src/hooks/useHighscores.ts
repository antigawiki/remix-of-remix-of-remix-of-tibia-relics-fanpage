import { useQuery } from '@tanstack/react-query';

export interface HighscoreEntry {
  name: string;
  profession: string;
  worldName: string;
  level: number;
  skillLevel: number;
}

export interface HighscoresResponse {
  highscores: HighscoreEntry[];
  lastUpdatedUtc: string;
}

export type HighscoreCategory = 
  | 'Experience' 
  | 'MagicLevel' 
  | 'FistFighting' 
  | 'ClubFighting' 
  | 'SwordFighting' 
  | 'AxeFighting' 
  | 'DistanceFighting' 
  | 'Shielding' 
  | 'Fishing';

export type HighscoreVocation = 
  | 'All' 
  | 'None' 
  | 'Knights' 
  | 'Paladins' 
  | 'Sorcerers' 
  | 'Druids';

const fetchHighscores = async (
  category: HighscoreCategory = 'Experience',
  vocation: HighscoreVocation = 'All'
): Promise<HighscoresResponse> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tibia-relic-proxy?endpoint=highscores&category=${category}&vocation=${vocation}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch highscores');
  }
  
  return response.json();
};

export const useHighscores = (
  category: HighscoreCategory = 'Experience',
  vocation: HighscoreVocation = 'All'
) => {
  return useQuery({
    queryKey: ['highscores', category, vocation],
    queryFn: () => fetchHighscores(category, vocation),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });
};

export const useTopPlayers = (limit: number = 5) => {
  const query = useHighscores('Experience', 'All');
  
  return {
    ...query,
    data: query.data ? {
      ...query.data,
      highscores: query.data.highscores.slice(0, limit),
    } : undefined,
  };
};

// Helper function to get display name for vocation
export const getVocationDisplayName = (profession: string): string => {
  if (profession === 'None' || !profession) {
    return 'Sem vocação';
  }
  return profession;
};

// Category display names in Portuguese
export const categoryDisplayNames: Record<HighscoreCategory, string> = {
  Experience: 'Experiência',
  MagicLevel: 'Magic Level',
  FistFighting: 'Fist Fighting',
  ClubFighting: 'Club Fighting',
  SwordFighting: 'Sword Fighting',
  AxeFighting: 'Axe Fighting',
  DistanceFighting: 'Distance Fighting',
  Shielding: 'Shielding',
  Fishing: 'Fishing',
};

// Vocation display names in Portuguese
export const vocationDisplayNames: Record<HighscoreVocation, string> = {
  All: 'Todas',
  None: 'Sem vocação',
  Knights: 'Knights',
  Paladins: 'Paladins',
  Sorcerers: 'Sorcerers',
  Druids: 'Druids',
};
