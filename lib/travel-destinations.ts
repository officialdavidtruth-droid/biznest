import { defaultPhoto } from "@/lib/default-images";

/**
 * Built-in destination guides for travel storefronts. These back the "Featured
 * Destinations" cards on the Wanderly home when an agency hasn't added its own
 * catalog items yet, so every card opens a real, good-looking page.
 * Guides are editorial content (no prices); live tours come from the agency's
 * own BizNest Travel packages, matched by destination name.
 */
export type DestinationGuide = {
  slug: string;
  name: string;
  region: string;
  tagline: string;
  photoId: string;
  overview: string;
  bestTime: string;
  idealFor: string;
  suggestedStay: string;
  highlights: Array<{ title: string; body: string }>;
  itinerary: Array<{ day: string; title: string; body: string }>;
  tips: string[];
};

export const DESTINATION_GUIDES: DestinationGuide[] = [
  {
    slug: "santorini",
    name: "Santorini",
    region: "Greece",
    tagline: "Whitewashed cliffs, volcanic sunsets and the deep blue Aegean.",
    photoId: "photo-1533105079780-92b9be482077",
    overview:
      "Santorini is the crescent-shaped remnant of a volcanic eruption, with villages perched along the rim of the caldera. It is made for slow mornings, long dinners and some of the most photographed sunsets in the world.",
    bestTime: "April to early November",
    idealFor: "Couples, honeymooners, photographers",
    suggestedStay: "4 to 6 nights",
    highlights: [
      { title: "Oia sunsets", body: "Arrive early and claim a spot along the castle ruins or the lanes above the caldera." },
      { title: "Caldera boat tour", body: "Sail past the volcano, swim in the hot springs and finish with dinner on the water." },
      { title: "Wine on volcanic soil", body: "Taste Assyrtiko and Vinsanto at family wineries with views over the vines." },
      { title: "Red and Black beaches", body: "Dramatic coastline carved by lava, ideal for a half-day swim and snorkel." },
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive and settle in", body: "Transfer to your caldera-view stay and take a first walk through Fira." },
      { day: "Day 2", title: "Fira to Oia", body: "Hike the clifftop trail between the villages and stay for sunset in Oia." },
      { day: "Day 3", title: "Sail the caldera", body: "Full-day catamaran with swim stops, hot springs and a seaside lunch." },
      { day: "Day 4", title: "Wine and beaches", body: "Winery tasting in the morning, then Red Beach and a relaxed evening." },
    ],
    tips: ["Book caldera-view rooms early, they sell out first.", "Wear flat shoes: the villages are all steps and stone.", "Shoulder months (May, Sept) mean fewer crowds and better prices."],
  },
  {
    slug: "bali",
    name: "Bali",
    region: "Indonesia",
    tagline: "Temples, rice terraces and beaches, all on one island.",
    photoId: "photo-1537996194471-e657df975ab4",
    overview:
      "Bali blends spiritual tradition with easy island living. Base yourself in Ubud for culture and rice terraces, then head to the coast for surf, cliffside beach clubs and sunsets at the sea temples.",
    bestTime: "April to October (dry season)",
    idealFor: "Couples, solo travellers, wellness seekers",
    suggestedStay: "7 to 10 nights",
    highlights: [
      { title: "Ubud and the rice terraces", body: "Walk the Tegallalang terraces, visit monkey forest and take a cooking class." },
      { title: "Water temples", body: "Ulun Danu Beratan and Tanah Lot are at their best in the early morning or at dusk." },
      { title: "Beaches and surf", body: "Uluwatu for dramatic cliffs and waves, Nusa Dua and Sanur for calm swimming." },
      { title: "Spa and wellness", body: "Daily yoga, traditional Balinese massage and retreats at very approachable prices." },
    ],
    itinerary: [
      { day: "Days 1 to 3", title: "Ubud", body: "Rice terraces, temples, a cooking class and a sunrise trek or waterfall visit." },
      { day: "Days 4 to 5", title: "Central highlands", body: "Lake Beratan temple, coffee plantations and a swing over the jungle." },
      { day: "Days 6 to 8", title: "Uluwatu coast", body: "Cliff-top temple at sunset, a beach day and a private surf lesson." },
      { day: "Days 9 to 10", title: "Sanur or Nusa Dua", body: "Slow down by the sea before your flight home." },
    ],
    tips: ["Hire a private driver for day trips, it is affordable and saves stress.", "Dress modestly at temples; sarongs are usually provided.", "Traffic is heavy around Canggu and Seminyak, plan buffer time."],
  },
  {
    slug: "maldives",
    name: "Maldives",
    region: "Indian Ocean",
    tagline: "Overwater villas, glassy lagoons and some of the clearest water on earth.",
    photoId: "photo-1507525428034-b723cf961d3e",
    overview:
      "A chain of coral atolls scattered across the Indian Ocean, the Maldives is the classic escape for rest and romance. Most resorts occupy their own island, so the experience is private, quiet and focused on the water.",
    bestTime: "November to April (dry season)",
    idealFor: "Honeymooners, anniversaries, divers",
    suggestedStay: "5 to 7 nights",
    highlights: [
      { title: "Overwater villa stays", body: "Step from your deck straight into the lagoon." },
      { title: "Snorkelling and diving", body: "House reefs teem with turtles, rays and reef sharks; whale sharks visit some atolls year-round." },
      { title: "Sandbank picnics", body: "Private boat trips to a sandbank for a castaway-style lunch." },
      { title: "Local island visits", body: "Budget-friendly guesthouses on inhabited islands let you experience everyday Maldivian life." },
    ],
    itinerary: [
      { day: "Day 1", title: "Arrival by speedboat or seaplane", body: "Transfer to your resort and settle in for sunset on the deck." },
      { day: "Days 2 to 3", title: "Reef and lagoon", body: "Guided snorkel, paddle-boarding and a spa treatment." },
      { day: "Day 4", title: "Island excursion", body: "Dolphin cruise or a visit to a local island and its market." },
      { day: "Days 5 to 6", title: "Free days", body: "Optional dive, sandbank picnic or simply nothing at all." },
    ],
    tips: ["Transfers (boat or seaplane) are a significant cost, ask what is included.", "Ask whether meals are all-inclusive; resort prices add up fast.", "Seaplanes only fly in daylight, so arrival time matters."],
  },
  {
    slug: "phuket",
    name: "Phuket",
    region: "Thailand",
    tagline: "Turquoise bays, island-hopping and legendary Thai food.",
    photoId: "photo-1506929562872-bb421503ef21",
    overview:
      "Thailand's largest island pairs lively beach towns with quiet coves and easy access to the Andaman islands. It suits families, friends and couples equally, with something for every budget.",
    bestTime: "November to April",
    idealFor: "Families, groups, first-time Asia travellers",
    suggestedStay: "5 to 8 nights",
    highlights: [
      { title: "Phi Phi and James Bond Island", body: "Speedboat or longtail day trips through limestone cliffs and clear bays." },
      { title: "Old Phuket Town", body: "Sino-Portuguese shophouses, street art, cafes and a Sunday walking market." },
      { title: "Beaches for every mood", body: "Kata and Karon for families, Kamala for quiet, Patong for nightlife." },
      { title: "Thai cooking and street food", body: "Join a market-to-table class or eat your way through the night markets." },
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive and unwind", body: "Check in near the beach and enjoy a first Thai dinner." },
      { day: "Day 2", title: "Phi Phi islands", body: "Full-day boat trip with snorkelling at Maya Bay and a beach lunch." },
      { day: "Day 3", title: "Old Town and culture", body: "Big Buddha, Wat Chalong and an evening in the Old Town." },
      { day: "Day 4", title: "Phang Nga Bay", body: "Sea-kayak through caves and lagoons beneath the limestone cliffs." },
    ],
    tips: ["Monsoon (May to Oct) brings rough seas and some trip cancellations.", "Agree boat-trip inclusions in advance (park fees, lunch, snorkel gear).", "Use licensed taxis or ride apps to avoid overcharging."],
  },
];

export const getDestinationGuide = (slug: string) => DESTINATION_GUIDES.find((d) => d.slug === slug) ?? null;
export const destinationPhoto = (g: DestinationGuide, width = 1600) => defaultPhoto(g.photoId, width);
export const guideSlugForName = (name: string | null | undefined) => {
  const n = (name ?? "").trim().toLowerCase();
  return DESTINATION_GUIDES.find((d) => d.name.toLowerCase() === n)?.slug ?? null;
};
