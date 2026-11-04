/**
 * Name shown to people in galleries and previews. The stored template name (used to link stores, previews and
 * thumbnails) never changes - many stores are tied to it - so niche words ("Restaurant", "Salon & Beauty") are
 * dropped only here. A template is a look, not a business type; the business is whatever the owner enters.
 * Hotel templates keep their full name because they are the hotel booking journey.
 */
const DISPLAY: Readonly<Record<string, string>> = {
  "Grandeur — Fine Dining Restaurant": "Grandeur",
  "TasteHouse — Food Delivery": "TasteHouse",
  "Example — Modern Electronics Store": "Example",
  "Electra — Smart Commerce": "Electra",
  "Atelier — Modern Fashion": "Atelier",
  "Kinetic — Sneaker Drop": "Kinetic",
  "Bloom — Beauty Boutique": "Bloom",
  "Haven — Home & Furniture": "Haven",
  "Harvest — Grocery Market": "Harvest",
  "Ember — Restaurant": "Ember",
  "Muse — Salon & Beauty": "Muse",
  "Frame — Photography Studio": "Frame",
  "North — Creative Agency": "North",
  "Pure — Cleaning Services": "Pure",
  "Forge — Construction": "Forge",
  "Vitalis — Clinic & Care": "Vitalis",
  "Pulse — Fitness & Wellness": "Pulse",
  "Gala — Events & Celebrations": "Gala",
  "Transit — Logistics & Delivery": "Transit",
  "Talent — Recruitment & HR": "Talent",
  "Wanderly Travel": "Wanderly",
  "Nestoria Real Estate": "Nestoria",
  "Emarket Furniture & Home": "Emarket",
  "Electra Blue Electronics": "Electra Blue",
  "TechNova Mobile Store": "TechNova",
  "ShopEase General Store": "ShopEase",
  "ShopNova Marketplace": "ShopNova",
  "Arcova Architecture": "Arcova",
  "Heenzy Sneaker Co.": "Heenzy",
  "rRW Premium Rental": "rRW Premium",
  "Premium Marketplace": "Premium",
  "Marketplace Hub": "Hub",
};

export function templateDisplayName(name: string): string {
  return DISPLAY[name] ?? name;
}
