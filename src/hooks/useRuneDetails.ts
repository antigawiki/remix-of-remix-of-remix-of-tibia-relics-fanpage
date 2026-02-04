import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VocationFood {
  name: string;
  image: string;
  quantity: number;
}

export interface VocationDetails {
  vocation: string;
  time: string;
  foods: VocationFood[];
}

export interface RuneDetails {
  name: string;
  image: string;
  spell: string;
  mana: number;
  vocations: VocationDetails[];
}

async function fetchRuneDetails(runeId: string): Promise<RuneDetails> {
  const { data, error } = await supabase.functions.invoke('scrape-rune-details', {
    body: { runeId },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function useRuneDetails(runeId: string | null) {
  return useQuery({
    queryKey: ['runeDetails', runeId],
    queryFn: () => fetchRuneDetails(runeId!),
    enabled: !!runeId,
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });
}
