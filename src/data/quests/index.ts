import { Language } from "@/i18n/types";
import { explorerSocietyAnkrahmun } from "./explorerSocietyAnkrahmun";

export type TranslatedText = Record<Language, string>;

export interface DialogueLine {
  speaker: 'player' | string;
  text: string;
}

export interface QuestSection {
  type: 'text' | 'dialogue' | 'images' | 'map';
  title?: TranslatedText;
  content?: TranslatedText;
  dialogue?: DialogueLine[];
  images?: string[];
  mapCoordinates?: { x: number; y: number; z: number; zoom?: number };
}

export interface Quest {
  id: string;
  slug: string;
  title: TranslatedText;
  description: TranslatedText;
  level?: number;
  premium?: boolean;
  available: boolean;
  requirements: {
    items: TranslatedText[];
    quests?: string[];
    other?: TranslatedText[];
  };
  rewards?: TranslatedText[];
  sections: QuestSection[];
}

export const quests: Quest[] = [
  explorerSocietyAnkrahmun,
];

export const getQuestBySlug = (slug: string): Quest | undefined => {
  return quests.find(q => q.slug === slug);
};
