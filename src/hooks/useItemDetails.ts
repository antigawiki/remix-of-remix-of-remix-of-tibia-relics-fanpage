import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NpcInfo {
  city: string;
  npc: string;
  price: string;
  mapUrl?: string;
}

export interface LootInfo {
  monster: string;
  image: string;
  amount: string;
  chance: string;
}

export interface ItemDetails {
  name: string;
  image: string;
  stats: {
    armor?: number;
    attack?: number;
    defense?: number;
    weight: string;
  };
  sellTo: NpcInfo[];
  buyFrom: NpcInfo[];
  lootedFrom: LootInfo[];
}

async function fetchItemDetails(itemName: string): Promise<ItemDetails | null> {
  const { data, error } = await supabase.functions.invoke('scrape-item-details', {
    body: { itemName }
  });

  if (error) {
    console.error('Error fetching item details:', error);
    throw new Error(error.message || 'Failed to fetch item details');
  }

  if (!data.success) {
    console.warn('Item details not found:', data.error);
    return null;
  }

  return data.data;
}

export function useItemDetails(itemName: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['itemDetails', itemName],
    queryFn: () => fetchItemDetails(itemName!),
    enabled: enabled && !!itemName,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    retry: 1,
  });
}
