export interface AmmoData {
  id: string;
  name: string;
  attack: number;
  image: string;
}

export const ammoData: AmmoData[] = [
  { id: "arrow", name: "Arrow", attack: 25, image: "https://tibiara.netlify.app/en/img/distance/arrow.gif" },
  { id: "bolt", name: "Bolt", attack: 30, image: "https://tibiara.netlify.app/en/img/distance/bolt.gif" },
  {
    id: "powerbolt",
    name: "Power Bolt",
    attack: 40,
    image: "https://tibiara.netlify.app/en/img/distance/powerbolt.gif",
  },
];

export type Vocation = "knight" | "paladin" | "sorcerer" | "druid";

export const vocationImages: Record<Vocation, string> = {
  knight: "https://tibiara.netlify.app/en/damage/img/kina.gif",
  paladin: "https://tibiara.netlify.app/en/damage/img/paladin.gif",
  sorcerer: "https://tibiara.netlify.app/en/damage/img/mage.gif",
  druid: "https://tibiara.netlify.app/en/damage/img/mage.gif",
};

export const vocationLabels: Record<Vocation, string> = {
  knight: "Knight",
  paladin: "Paladin",
  sorcerer: "Sorcerer",
  druid: "Druid",
};

export const calculatePhysicalDamage = (skill: number, weaponAttack: number) => {
  const maxDamage = Math.round((skill / 18) * weaponAttack + weaponAttack);
  const pvpDamage = Math.round(maxDamage / 2);
  return { maxDamage, pvpDamage };
};
