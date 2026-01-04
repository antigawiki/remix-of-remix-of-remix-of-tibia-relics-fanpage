export interface Equipment {
  name: string;
  image: string;
  armor?: number;
  attack?: number;
  defense?: number;
  weight: string;
  attributes?: string;
  vocations?: string;
  levelRequired?: number;
}

export const helmets: Equipment[] = [
  { name: "Ancient Tiara", image: "https://tibiara.netlify.app/en/img/helmets/4635.png", armor: 0, weight: "8.2 oz." },
  { name: "Crown", image: "https://tibiara.netlify.app/en/img/helmets/1865.png", armor: 0, weight: "19 oz." },
  { name: "Leather Helmet", image: "https://tibiara.netlify.app/en/img/helmets/502.png", armor: 1, weight: "22 oz." },
  { name: "Studded Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1876.png", armor: 2, weight: "14 oz." },
  { name: "Chain Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1757.png", armor: 2, weight: "42 oz." },
  { name: "Brass Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1785.png", armor: 3, weight: "27 oz." },
  { name: "Legion Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1872.png", armor: 4, weight: "32 oz." },
  { name: "Iron Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1849.png", armor: 5, weight: "45 oz." },
  { name: "Viking Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1898.png", armor: 5, weight: "35 oz." },
  { name: "Soldier Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1883.png", armor: 5, weight: "29 oz." },
  { name: "Steel Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1892.png", armor: 6, weight: "46 oz." },
  { name: "Dark Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1811.png", armor: 6, weight: "46 oz." },
  { name: "Mystic Turban", image: "https://tibiara.netlify.app/en/img/helmets/1873.png", armor: 3, weight: "8 oz.", attributes: "+1 magic level" },
  { name: "Strange Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1888.png", armor: 6, weight: "46 oz." },
  { name: "Crown Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1809.png", armor: 7, weight: "29.5 oz." },
  { name: "Crusader Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1807.png", armor: 8, weight: "52 oz." },
  { name: "Noble Armor", image: "https://tibiara.netlify.app/en/img/helmets/1874.png", armor: 8, weight: "30 oz." },
  { name: "Warrior Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1901.png", armor: 9, weight: "32 oz." },
  { name: "Amazon Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1784.png", armor: 6, weight: "17 oz." },
  { name: "Devil Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1813.png", armor: 10, weight: "31 oz." },
  { name: "Giant Sword", image: "https://tibiara.netlify.app/en/img/helmets/1835.png", armor: 10, weight: "180 oz." },
  { name: "Demon Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1812.png", armor: 11, weight: "29.5 oz." },
  { name: "Winged Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1899.png", armor: 9, weight: "32 oz." },
  { name: "Royal Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1881.png", armor: 9, weight: "48 oz." },
  { name: "Hat of the Mad", image: "https://tibiara.netlify.app/en/img/helmets/1842.png", armor: 5, weight: "6.5 oz.", attributes: "+1 magic level" },
  { name: "Post Officers Hat", image: "https://tibiara.netlify.app/en/img/helmets/1878.png", armor: 1, weight: "11 oz." },
  { name: "Magician Hat", image: "https://tibiara.netlify.app/en/img/helmets/1863.png", armor: 1, weight: "6 oz." },
  { name: "Ceremonial Mask", image: "https://tibiara.netlify.app/en/img/helmets/1796.png", armor: 2, weight: "35 oz." },
  { name: "Charmer's Tiara", image: "https://tibiara.netlify.app/en/img/helmets/1798.png", armor: 2, weight: "8.2 oz." },
  { name: "Feather Cap", image: "https://tibiara.netlify.app/en/img/helmets/1820.png", armor: 2, weight: "9 oz." },
  { name: "Horseman Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1847.png", armor: 6, weight: "27 oz." },
  { name: "Golden Helmet", image: "https://tibiara.netlify.app/en/img/helmets/928.png", armor: 12, weight: "32 oz." },
];
