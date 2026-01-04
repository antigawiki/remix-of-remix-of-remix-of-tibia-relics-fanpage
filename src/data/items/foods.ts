export interface Item {
  name: string;
  image: string;
  weight?: string;
  description?: string;
  attributes?: string;
}

export const foods: Item[] = [
  { name: "Meat", image: "https://tibiara.netlify.app/en/img/items/2666.png", weight: "15 oz.", description: "Recupera HP" },
  { name: "Ham", image: "https://tibiara.netlify.app/en/img/items/2671.png", weight: "10 oz.", description: "Recupera HP" },
  { name: "Dragon Ham", image: "https://tibiara.netlify.app/en/img/items/2672.png", weight: "30 oz.", description: "Recupera HP" },
  { name: "Fish", image: "https://tibiara.netlify.app/en/img/items/2667.png", weight: "4 oz.", description: "Recupera HP" },
  { name: "Salmon", image: "https://tibiara.netlify.app/en/img/items/2668.png", weight: "6 oz.", description: "Recupera HP" },
  { name: "Brown Bread", image: "https://tibiara.netlify.app/en/img/items/2689.png", weight: "3 oz.", description: "Recupera HP" },
  { name: "Cheese", image: "https://tibiara.netlify.app/en/img/items/2696.png", weight: "4 oz.", description: "Recupera HP" },
  { name: "Apple", image: "https://tibiara.netlify.app/en/img/items/2674.png", weight: "2 oz.", description: "Recupera HP" },
  { name: "Orange", image: "https://tibiara.netlify.app/en/img/items/2675.png", weight: "5 oz.", description: "Recupera HP" },
  { name: "Cookie", image: "https://tibiara.netlify.app/en/img/items/2687.png", weight: "0.2 oz.", description: "Recupera HP" },
  { name: "Brown Mushroom", image: "https://tibiara.netlify.app/en/img/items/2789.png", weight: "0.2 oz.", description: "Recupera HP" },
  { name: "White Mushroom", image: "https://tibiara.netlify.app/en/img/items/2787.png", weight: "0.2 oz.", description: "Recupera HP" },
];
