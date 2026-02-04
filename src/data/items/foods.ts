export interface Item {
  name: string;
  image: string;
  weight?: string;
  description?: string;
  attributes?: string;
  duration?: string;
  slots?: number;
  city?: string;
  charges?: number;
}

export const foods: Item[] = [
  { name: "Dragon Ham", image: "https://tibiara.netlify.app/en/img/food/dragon_meat.gif", weight: "30 oz.", duration: "12 min" },
  { name: "Fire Mushroom", image: "https://tibiara.netlify.app/en/img/food/626.gif", weight: "0.1 oz.", duration: "7 min 12 sec" },
  { name: "Ham", image: "https://tibiara.netlify.app/en/img/food/199.gif", weight: "20 oz.", duration: "6 min" },
  { name: "Brown Mushroom", image: "https://tibiara.netlify.app/en/img/food/620.gif", weight: "0.2 oz.", duration: "4 min 26 sec" },
  { name: "Melon", image: "https://tibiara.netlify.app/en/img/food/196.gif", weight: "9.5 oz.", duration: "4 min" },
  { name: "Pumpkin", image: "https://tibiara.netlify.app/en/img/food/698.gif", weight: "13.5 oz.", duration: "3 min 24 sec" },
  { name: "Meat", image: "https://tibiara.netlify.app/en/img/food/200.gif", weight: "13 oz.", duration: "3 min" },
  { name: "Coconut", image: "https://tibiara.netlify.app/en/img/food/201.gif", weight: "4.8 oz.", duration: "2 min 36 sec" },
  { name: "Orange", image: "https://tibiara.netlify.app/en/img/food/204.gif", weight: "1.1 oz.", duration: "2 min 36 sec" },
  { name: "Fish", image: "https://tibiara.netlify.app/en/img/food/194.gif", weight: "5.2 oz.", duration: "2 min 24 sec" },
  { name: "Bread", image: "https://tibiara.netlify.app/en/img/food/198.gif", weight: "5 oz.", duration: "2 min" },
  { name: "Salmon", image: "https://tibiara.netlify.app/en/img/food/191.gif", weight: "3.2 oz.", duration: "2 min" },
  { name: "Cheese", image: "https://tibiara.netlify.app/en/img/food/195.gif", weight: "4 oz.", duration: "1 min 48 sec" },
  { name: "Corncob", image: "https://tibiara.netlify.app/en/img/food/193.gif", weight: "3.5 oz.", duration: "1 min 48 sec" },
  { name: "Grapes", image: "https://tibiara.netlify.app/en/img/food/192.gif", weight: "2.5 oz.", duration: "1 min 48 sec" },
  { name: "White Mushroom", image: "https://tibiara.netlify.app/en/img/food/344.gif", weight: "0.4 oz.", duration: "1 min 48 sec" },
  { name: "Wood Mushroom", image: "https://tibiara.netlify.app/en/img/food/625.gif", weight: "0.1 oz.", duration: "1 min 48 sec" },
  { name: "Banana", image: "https://tibiara.netlify.app/en/img/food/187.gif", weight: "1.8 oz.", duration: "1 min 36 sec" },
  { name: "Brown Bread", image: "https://tibiara.netlify.app/en/img/food/197.gif", weight: "4 oz.", duration: "1 min 36 sec" },
  { name: "Carrot", image: "https://tibiara.netlify.app/en/img/food/189.gif", weight: "2 oz.", duration: "1 min 36 sec" },
  { name: "Apple", image: "https://tibiara.netlify.app/en/img/food/188.gif", weight: "1.5 oz.", duration: "1 min 12 sec" },
  { name: "Dark Mushroom", image: "https://tibiara.netlify.app/en/img/food/623.gif", weight: "0.1 oz.", duration: "1 min 12 sec" },
  { name: "Tomato", image: "https://tibiara.netlify.app/en/img/food/709.gif", weight: "1 oz.", duration: "1 min 12 sec" },
  { name: "Pears", image: "https://tibiara.netlify.app/en/img/food/687.gif", weight: "1.4 oz.", duration: "1 min" },
  { name: "Green Mushroom", image: "https://tibiara.netlify.app/en/img/food/627.gif", weight: "0.1 oz.", duration: "1 min" },
  { name: "Red Mushroom", image: "https://tibiara.netlify.app/en/img/food/619.gif", weight: "0.5 oz.", duration: "48 sec" },
  { name: "Some Mushroom", image: "https://tibiara.netlify.app/en/img/food/624.gif", weight: "0.1 oz.", duration: "36 sec" },
  { name: "Roll", image: "https://tibiara.netlify.app/en/img/food/190.gif", weight: "0.8 oz.", duration: "36 sec" },
  { name: "Cookie", image: "https://tibiara.netlify.app/en/img/food/202.gif", weight: "0.1 oz.", duration: "24 sec" },
  { name: "Strawberry", image: "https://tibiara.netlify.app/en/img/food/691.gif", weight: "0.2 oz.", duration: "24 sec" },
  { name: "Blueberry", image: "https://tibiara.netlify.app/en/img/food/729.gif", weight: "0.2 oz.", duration: "12 sec" },
  { name: "Cherry", image: "https://tibiara.netlify.app/en/img/food/186.gif", weight: "0.2 oz.", duration: "12 sec" },
  { name: "Dough", image: "https://tibiara.netlify.app/en/img/food/207.gif", weight: "5 oz.", duration: "0 sec" },
  { name: "Flour", image: "https://tibiara.netlify.app/en/img/food/206.gif", weight: "5 oz.", duration: "0 sec" },
  { name: "Wheat", image: "https://tibiara.netlify.app/en/img/food/205.gif", weight: "12.5 oz.", duration: "0 sec" },
];
