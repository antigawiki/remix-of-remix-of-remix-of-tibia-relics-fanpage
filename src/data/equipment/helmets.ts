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
  { name: "Magic Hat", image: "https://tibiara.netlify.app/en/img/helmets/3361.png", armor: 1, weight: "7.5 oz." },
  { name: "Mystic Turban", image: "https://tibiara.netlify.app/en/img/helmets/3363.png", armor: 1, weight: "8.5 oz." },
  {
    name: "Post Officers Hat",
    image: "https://tibiara.netlify.app/en/img/helmets/1069.png",
    armor: 1,
    weight: "7 oz.",
  },
  { name: "Chain Helmet", image: "https://tibiara.netlify.app/en/img/helmets/500.png", armor: 2, weight: "42 oz." },
  {
    name: "Studded Helmet",
    image: "https://tibiara.netlify.app/en/img/helmets/2237.png",
    armor: 2,
    weight: "24.5 oz.",
  },
  { name: "Wood Cape", image: "https://tibiara.netlify.app/en/img/helmets/3388.png", armor: 2, weight: "11 oz." },
  { name: "Brass Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1872.png", armor: 3, weight: "27 oz." },
  { name: "Hat of the Mad", image: "https://tibiara.netlify.app/en/img/helmets/3361.png", armor: 3, weight: "7 oz." },
  { name: "Legion Helmet", image: "https://tibiara.netlify.app/en/img/helmets/2235.png", armor: 4, weight: "31 oz." },
  { name: "Viking Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1124.png", armor: 4, weight: "39 oz." },
  { name: "Iron Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1871.png", armor: 5, weight: "30 oz." },
  { name: "Soldier Helmet", image: "https://tibiara.netlify.app/en/img/helmets/2236.png", armor: 5, weight: "32 oz." },
  { name: "Dark Helmet", image: "https://tibiara.netlify.app/en/img/helmets/2230.png", armor: 6, weight: "46 oz." },
  { name: "Dwarven Helmet", image: "https://tibiara.netlify.app/en/img/helmets/4781.png", armor: 6, weight: "42 oz." },
  { name: "Steel Helmet", image: "https://tibiara.netlify.app/en/img/helmets/499.png", armor: 6, weight: "46 oz." },
  { name: "Strange Helmet", image: "https://tibiara.netlify.app/en/img/helmets/2234.png", armor: 6, weight: "46 oz." },
  { name: "Amazon Helmet", image: "https://tibiara.netlify.app/en/img/helmets/4602.png", armor: 7, weight: "29.5 oz." },
  { name: "Crown Helmet", image: "https://tibiara.netlify.app/en/img/helmets/2247.png", armor: 7, weight: "29.5 oz." },
  { name: "Devil Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1883.png", armor: 7, weight: "50 oz." },
  { name: "Crusader Helmet", image: "https://tibiara.netlify.app/en/img/helmets/3362.png", armor: 9, weight: "52 oz." },
  { name: "Warrior Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1126.png", armor: 9, weight: "68 oz." },
  {
    name: "Ceremonial Mask",
    image: "https://tibiara.netlify.app/en/img/helmets/4633.png",
    armor: 10,
    weight: "40 oz.",
  },
  {
    name: "Helmet of the Ancients",
    image: "https://tibiara.netlify.app/en/img/helmets/5916.png",
    armor: 11,
    weight: "27.6 oz.",
  },
  { name: "Royal Helmet", image: "https://tibiara.netlify.app/en/img/helmets/3385.png", armor: 11, weight: "48 oz." },
  { name: "Winged Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1125.png", armor: 12, weight: "12 oz." },
  { name: "Demon Helmet", image: "https://tibiara.netlify.app/en/img/helmets/709.png", armor: 13, weight: "29.5 oz." },
  {
    name: "Dragon Scale Helmet",
    image: "https://tibiara.netlify.app/en/img/helmets/6535.png",
    armor: 11,
    weight: "29.5 oz.",
  },
  { name: "Horned Helmet", image: "https://tibiara.netlify.app/en/img/helmets/1056.png", armor: 15, weight: "51 oz." },
  { name: "Golden Helmet", image: "https://tibiara.netlify.app/en/img/helmets/928.png", armor: 17, weight: "32 oz." },
];
