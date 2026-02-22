import { useQuery } from '@tanstack/react-query';

export interface HouseStatus {
  type: string;
  bidAmount?: number;
  bidLimit?: number;
  finishTime?: string;
  auctionedBy?: string;
  rentedBy?: string;
}

export interface House {
  houseId: number;
  name: string;
  description: string;
  size: number;
  rent: number;
  town: string;
  guildHouse: boolean;
  status: HouseStatus;
  beds: number;
}

export type HouseType = 'HousesAndFlats' | 'GuildHalls';
export type HouseStatusFilter = 'All' | 'Auctioned' | 'Rented';

const wordToNumber: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, 'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23,
  'twenty-four': 24, 'twenty-five': 25, 'twenty-six': 26, 'twenty-seven': 27, 'twenty-eight': 28,
  'twenty-nine': 29, thirty: 30,
};

export function extractBeds(description: string): number {
  if (!description) return 0;
  // Try numeric first: "3 beds"
  const numMatch = description.match(/(\d+)\s*beds?/i);
  if (numMatch) return parseInt(numMatch[1], 10);
  // Try word: "ten beds"
  const wordMatch = description.match(/([\w-]+)\s+beds?/i);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    return wordToNumber[word] ?? 0;
  }
  return 0;
}

const fetchHouses = async (type: HouseType, status: HouseStatusFilter, town: string): Promise<House[]> => {
  const params = new URLSearchParams({
    endpoint: 'houses',
    type,
    status,
  });
  if (town) params.set('town', town);

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tibia-relic-proxy?${params}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
  });
  if (!response.ok) throw new Error('Failed to fetch houses');
  const data = await response.json();

  // data can be array or { houses: [...] }
  const houses: any[] = Array.isArray(data) ? data : (data.houses ?? data.houseList ?? []);
  return houses.map((h: any) => ({
    ...h,
    beds: extractBeds(h.description ?? ''),
  }));
};

export const useHouses = (type: HouseType, status: HouseStatusFilter, town: string) => {
  return useQuery({
    queryKey: ['houses', type, status, town],
    queryFn: () => fetchHouses(type, status, town),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};

export const TOWNS = [
  "Ab'Dendriel", "Ankrahmun", "Carlin", "Darashia", "Edron",
  "Kazordoon", "Liberty Bay", "Port Hope", "Svargrond", "Thais", "Venore", "Yalahar",
];
