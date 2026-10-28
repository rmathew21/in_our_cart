/**
 * Picks an emoji for common grocery and household items by keyword.
 * Keys are lowercase and singular; multi-word keys win over single words,
 * so "peanut butter" beats "butter" and "ice cream" beats "cream".
 * Unrecognized items get no icon.
 */
const ICONS: Record<string, string> = {
  // Fruit
  apple: "🍎", banana: "🍌", orange: "🍊", mandarin: "🍊", clementine: "🍊", tangerine: "🍊",
  lemon: "🍋", lime: "🍋", grape: "🍇", raisin: "🍇", strawberry: "🍓", raspberry: "🍓", berry: "🍓",
  blueberry: "🫐", cherry: "🍒", peach: "🍑", nectarine: "🍑", pear: "🍐", pineapple: "🍍",
  mango: "🥭", melon: "🍈", cantaloupe: "🍈", watermelon: "🍉", kiwi: "🥝", coconut: "🥥",
  avocado: "🥑", "coconut milk": "🥥",
  // Vegetables and herbs
  tomato: "🍅", potato: "🥔", "sweet potato": "🍠", yam: "🍠", carrot: "🥕", corn: "🌽",
  broccoli: "🥦", cauliflower: "🥦", lettuce: "🥬", spinach: "🥬", kale: "🥬", cabbage: "🥬",
  "bok choy": "🥬", greens: "🥬", celery: "🥬", cucumber: "🥒", zucchini: "🥒", pickle: "🥒",
  pepper: "🫑", "bell pepper": "🫑", jalapeno: "🌶️", chili: "🌶️", "hot sauce": "🌶️",
  onion: "🧅", shallot: "🧅", garlic: "🧄", mushroom: "🍄", eggplant: "🍆", olive: "🫒",
  salad: "🥗", herb: "🌿", basil: "🌿", cilantro: "🌿", parsley: "🌿", mint: "🌿", rosemary: "🌿",
  thyme: "🌿", dill: "🌿",
  // Dairy and eggs
  milk: "🥛", "almond milk": "🥛", "oat milk": "🥛", cream: "🥛", "heavy cream": "🥛",
  "sour cream": "🥛", yogurt: "🥛", "ice cream": "🍨", cheese: "🧀", cheddar: "🧀",
  mozzarella: "🧀", parmesan: "🧀", butter: "🧈", egg: "🥚",
  // Bakery
  bread: "🍞", loaf: "🍞", bun: "🍞", roll: "🍞", toast: "🍞", bagel: "🥯", croissant: "🥐",
  baguette: "🥖", tortilla: "🫓", pita: "🫓", naan: "🫓", muffin: "🧁", cupcake: "🧁",
  cake: "🍰", cookie: "🍪", donut: "🍩", doughnut: "🍩", pie: "🥧", pancake: "🥞", waffle: "🧇",
  // Meat and seafood
  chicken: "🍗", wing: "🍗", turkey: "🦃", beef: "🥩", steak: "🥩", "ground beef": "🥩",
  pork: "🥩", lamb: "🍖", rib: "🍖", ham: "🍖", bacon: "🥓", sausage: "🌭", "hot dog": "🌭",
  fish: "🐟", salmon: "🐟", tuna: "🐟", tilapia: "🐟", cod: "🐟", shrimp: "🦐", prawn: "🦐",
  crab: "🦀", lobster: "🦞", oyster: "🦪",
  // Pantry
  rice: "🍚", pasta: "🍝", spaghetti: "🍝", noodle: "🍜", ramen: "🍜", soup: "🥫",
  broth: "🥫", stock: "🥫", sauce: "🥫", "tomato sauce": "🥫", bean: "🫘", lentil: "🫘",
  chickpea: "🫘", flour: "🌾", oat: "🌾", oatmeal: "🥣", cereal: "🥣", granola: "🥣",
  honey: "🍯", "maple syrup": "🍯", syrup: "🍯", "peanut butter": "🥜", peanut: "🥜", nut: "🥜",
  almond: "🥜", cashew: "🥜", walnut: "🥜", pecan: "🥜", salt: "🧂", "black pepper": "🧂",
  spice: "🧂", seasoning: "🧂", cinnamon: "🧂", "olive oil": "🫒", chocolate: "🍫",
  candy: "🍬", popcorn: "🍿", pretzel: "🥨", sugar: "🍬", ketchup: "🍅",
  // Prepared food
  pizza: "🍕", taco: "🌮", burrito: "🌯", sandwich: "🥪", burger: "🍔", hamburger: "🍔",
  fry: "🍟", "french fry": "🍟", sushi: "🍣", dumpling: "🥟",
  // Drinks
  coffee: "☕", tea: "🍵", water: "💧", "sparkling water": "💧", juice: "🧃",
  "orange juice": "🧃", "apple juice": "🧃", soda: "🥤", lemonade: "🥤", beer: "🍺",
  wine: "🍷", champagne: "🍾", ice: "🧊",
  // Household and personal care
  "paper towel": "🧻", "toilet paper": "🧻", tissue: "🧻", napkin: "🧻", soap: "🧼",
  "dish soap": "🧼", "hand soap": "🧼", detergent: "🧺", laundry: "🧺", sponge: "🧽",
  "trash bag": "🗑️", "garbage bag": "🗑️", toothpaste: "🪥", toothbrush: "🪥",
  shampoo: "🧴", conditioner: "🧴", lotion: "🧴", sunscreen: "🧴", deodorant: "🧴",
  battery: "🔋", "light bulb": "💡", candle: "🕯️", medicine: "💊", vitamin: "💊",
  "dog food": "🐶", "cat food": "🐱", "cat litter": "🐱", flower: "💐",
};

const KEYS = Object.keys(ICONS).sort((a, b) => b.length - a.length);

function singular(word: string): string {
  if (word.length <= 3 || word.endsWith("ss") || word.endsWith("us")) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`; // berries -> berry, fries -> fry
  if (/(ch|sh|x|o)es$/.test(word)) return word.slice(0, -2); // peaches, tomatoes
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

const cache = new Map<string, string | null>();

export function iconFor(name: string): string | null {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const words = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // jalapeño -> jalapeno
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
  const padded = ` ${words.join(" ")} `;

  let icon: string | null = null;
  for (const key of KEYS) {
    if (padded.includes(` ${key} `)) {
      icon = ICONS[key] ?? null;
      break;
    }
  }
  cache.set(name, icon);
  return icon;
}
