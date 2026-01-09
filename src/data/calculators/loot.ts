export interface LootItem {
  name: string;
  price: number;
  image: string;
}

export const lootItems: LootItem[] = [
  { name: "Battle Axe", price: 80, image: "https://tibiara.netlify.app/en/img/axes/114.png" },
  { name: "Battle Hammer", price: 120, image: "https://tibiara.netlify.app/en/img/clubs/504.png" },
  { name: "Battle Shield", price: 95, image: "https://tibiara.netlify.app/en/img/shields/1134.png" },
  { name: "Brass Armor", price: 150, image: "https://tibiara.netlify.app/en/img/armors/1936.png" },
  { name: "Brass Helmet", price: 30, image: "https://tibiara.netlify.app/en/img/helmets/1872.png" },
  { name: "Brass Legs", price: 49, image: "https://tibiara.netlify.app/en/img/legs/1937.png" },
  { name: "Brass Shield", price: 16, image: "https://tibiara.netlify.app/en/img/shields/1867.png" },
  { name: "Bow", price: 130, image: "https://tibiara.netlify.app/en/img/distance/bow.gif" },
  { name: "Chain Armor", price: 70, image: "https://tibiara.netlify.app/en/img/armors/306.png" },
  { name: "Chain Helmet", price: 17, image: "https://tibiara.netlify.app/en/img/helmets/500.png" },
  { name: "Chain Legs", price: 25, image: "https://tibiara.netlify.app/en/img/legs/1575.png" },
  { name: "Crossbow", price: 160, image: "https://tibiara.netlify.app/en/img/distance/xbow.gif" },
  { name: "Double Axe", price: 260, image: "https://tibiara.netlify.app/en/img/axes/1130.png" },
  { name: "Dwarven Shield", price: 100, image: "https://tibiara.netlify.app/en/img/shields/2242.png" },
  { name: "Halberd", price: 400, image: "https://tibiara.netlify.app/en/img/axes/503.png" },
  { name: "Iron Helmet", price: 150, image: "https://tibiara.netlify.app/en/img/helmets/1871.png" },
  { name: "Leather Armor", price: 12, image: "https://tibiara.netlify.app/en/img/armors/308.png" },
  { name: "Longsword", price: 51, image: "https://tibiara.netlify.app/en/img/swords/1876.png" },
  { name: "Mace", price: 30, image: "https://tibiara.netlify.app/en/img/clubs/1877.png" },
  { name: "Morning Star", price: 100, image: "https://tibiara.netlify.app/en/img/clubs/1127.png" },
  { name: "Plate Armor", price: 400, image: "https://tibiara.netlify.app/en/img/armors/4338.png" },
  { name: "Plate Legs", price: 115, image: "https://tibiara.netlify.app/en/img/legs/4339.png" },
  { name: "Plate Shield", price: 45, image: "https://tibiara.netlify.app/en/img/shields/1129.png" },
  { name: "Sabre", price: 12, image: "https://tibiara.netlify.app/en/img/swords/1218.png" },
  { name: "Scale Armor", price: 75, image: "https://tibiara.netlify.app/en/img/armors/2238.png" },
  { name: "Steel Helmet", price: 293, image: "https://tibiara.netlify.app/en/img/helmets/499.png" },
  { name: "Steel Shield", price: 80, image: "https://tibiara.netlify.app/en/img/shields/305.png" },
  { name: "Studded Shield", price: 16, image: "https://tibiara.netlify.app/en/img/shields/2243.png" },
  { name: "Sword", price: 25, image: "https://tibiara.netlify.app/en/img/swords/2.png" },
  { name: "Two Handed Sword", price: 450, image: "https://tibiara.netlify.app/en/img/swords/116.png" },
  { name: "Viking Helmet", price: 66, image: "https://tibiara.netlify.app/en/img/helmets/1124.png" },
].sort((a, b) => a.name.localeCompare(b.name));

export interface LootEntry {
  id: string;
  item: LootItem | null;
  quantity: number;
}

export interface LootCalculationResult {
  items: { item: LootItem; quantity: number; subtotal: number }[];
  total: number;
}

export function calculateLoot(entries: LootEntry[]): LootCalculationResult {
  const validItems = entries
    .filter((entry) => entry.item !== null && entry.quantity > 0)
    .map((entry) => ({
      item: entry.item!,
      quantity: entry.quantity,
      subtotal: entry.item!.price * entry.quantity,
    }));

  const total = validItems.reduce((sum, item) => sum + item.subtotal, 0);

  return { items: validItems, total };
}
