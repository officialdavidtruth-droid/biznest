// Customer chat setup: FAQs per business type, keyword matching for auto-replies, and config parsing.
// Pure helpers (no DB) so both server actions and client components can import the types and defaults.
import { canonicalizeBusinessType, type CanonicalBusinessType } from "@/lib/business-identity";

export type StoreFaq = { id: string; topic: string; question: string; answer: string; enabled: boolean };
export type MessagingConfig = { autoReply: boolean; humanHandoff: boolean; faqs: StoreFaq[] };

type Seed = [topic: string, question: string, answer: string];

const COMMERCE: Seed[] = [
  ["Orders & delivery", "How long does delivery take?", "Thanks for asking! Delivery time depends on your location. You'll see the estimate at checkout, and we'll message you once your order ships. Need it faster? Tell us your area and we'll help."],
  ["Orders & delivery", "Where is my order?", "You can follow your order any time under Orders in your account. If the status hasn't moved in a while, tap \"Talk to a human\" and we'll check it for you right away."],
  ["Payments", "Which payment methods do you accept?", "We accept the payment options shown at checkout (card, bank transfer and others where available). If a payment failed or you were debited twice, tell us and a team member will sort it out."],
  ["Returns & refunds", "Can I return or exchange an item?", "Yes, if something isn't right, message us within a few days of receiving it with your order number and a photo. We'll explain the return or exchange steps."],
  ["Availability", "Is this item in stock?", "Stock levels show on each product page. If an item is sold out, tell us which one and we'll let you know when it's back."],
  ["Pricing", "Do you offer discounts or bulk prices?", "We run offers from time to time, and bulk orders are welcome. Tell us what you need and how many, and the team will send you a price."],
];

const SEEDS: Partial<Record<CanonicalBusinessType, Seed[]>> = {
  "Hotel & Lodging": [
    ["Bookings", "How do I book a room?", "Choose your dates and room on our Rooms page and complete the booking form. You'll get a confirmation message straight away. Prefer help? Tap \"Talk to a human\"."],
    ["Availability", "Is a room available on my dates?", "Send us your check-in and check-out dates and number of guests, and we'll confirm availability and the best rate."],
    ["Check-in & check-out", "What are the check-in and check-out times?", "Check-in and check-out times are listed on each room page. Need an early arrival or late departure? Tell us and we'll do our best to arrange it."],
    ["Payments", "How do I pay for my booking?", "You can pay online when you book using the options shown at checkout. If you'd rather pay another way, message us and we'll guide you."],
    ["Cancellations", "Can I cancel or change my booking?", "Yes, message us with your booking details and we'll explain the cancellation and change options that apply to your stay."],
    ["Amenities", "What amenities do you offer?", "Each room page lists its amenities, and our Amenities page covers the rest of the property. Looking for something specific? Just ask."],
    ["Location", "Where are you located and is there parking?", "Our address and directions are on our Contact page. Tell us if you need help with parking or airport pickup."],
  ],
  Restaurant: [
    ["Orders & delivery", "Do you deliver?", "Yes, delivery is available in selected areas. Add your items to the cart, enter your address at checkout, and you'll see if we reach you."],
    ["Menu", "Can I see your menu and prices?", "Our full menu with prices is on our Menu page. Ask us if you need something that's not listed, like a custom order."],
    ["Bookings", "Can I reserve a table?", "Yes. Send us the date, time and number of guests, and we'll confirm your table."],
    ["Dietary", "Do you cater for dietary needs or allergies?", "Tell us about any allergies or dietary needs before you order, and we'll advise you on the safest choices."],
    ["Orders & delivery", "How long will my order take?", "Preparation time depends on how busy we are and what you ordered. We'll update you as soon as your order is on its way."],
    ["Events", "Do you take bulk or event orders?", "Yes, we cater for parties and events. Tell us the date, the number of people and your budget, and we'll prepare a quote."],
  ],
  Beauty: [
    ["Bookings", "How do I book an appointment?", "Pick a service and time on our Services page and complete the booking. You'll get a confirmation right away."],
    ["Pricing", "How much do your services cost?", "Prices are listed on each service page. For custom styles or packages, message us and we'll give you an exact quote."],
    ["Bookings", "Can I reschedule or cancel?", "Yes. Message us as early as you can with your booking details and we'll move or cancel it."],
    ["Payments", "Do I pay before or after the service?", "That depends on the service. You'll see the payment option at booking, and a deposit may apply for longer sessions."],
    ["Location", "Where are you located?", "Our address and opening hours are on our Contact page. We can also share directions on request."],
  ],
  "Professional Services": [
    ["Services", "What services do you offer?", "Our full list of services is on the Services page. Tell us what you need and we'll recommend the best fit."],
    ["Pricing", "How much will it cost?", "Pricing depends on the scope of work. Share a few details about your project and we'll send you a clear quote."],
    ["Bookings", "How do I book a consultation?", "Choose a time on our Booking page, or message us your preferred date and we'll confirm it."],
    ["Timeline", "How long will the work take?", "Timelines depend on the project. After a quick chat about your needs we'll give you a realistic schedule."],
    ["Payments", "How do payments work?", "You'll see the payment options when you book or accept a quote. For larger projects we can agree on milestones."],
  ],
  "Real Estate": [
    ["Viewings", "How do I book a viewing?", "Tell us which property you're interested in and your preferred date, and we'll arrange the viewing."],
    ["Pricing", "What are the price and payment terms?", "Prices and payment terms are on each listing. Message us if you'd like to discuss a payment plan."],
    ["Availability", "Is this property still available?", "Availability changes quickly. Send us the property name and we'll confirm it's still open."],
    ["Documents", "What documents come with the property?", "We'll walk you through the title and other documents for any property you're serious about. Ask us to start the conversation."],
  ],
  Health: [
    ["Bookings", "How do I book an appointment?", "Choose a service and time on our Booking page, or message us your preferred date and we'll confirm."],
    ["Pricing", "How much does a consultation cost?", "Fees are listed on each service page. Contact us if you need help with a package or a specific treatment."],
    ["Location", "Where are you and what are your hours?", "Our address and opening hours are on our Contact page."],
    ["Bookings", "Can I reschedule my appointment?", "Yes. Message us with your booking details and a new preferred time, and we'll sort it out."],
  ],
  "Event Planning": [
    ["Bookings", "How do I book you for my event?", "Send us your event date, location, guest count and budget, and we'll reply with availability and a proposal."],
    ["Pricing", "How much do your packages cost?", "Packages depend on the event size and services you choose. Share your details and we'll send you a quote."],
    ["Payments", "Do I need to pay a deposit?", "A deposit secures your date, and the balance is due before the event. We'll confirm the exact terms in your quote."],
  ],
  Automotive: [
    ["Services", "Can I book a service or repair?", "Yes, tell us your car make, model and the issue, and we'll find you a time."],
    ["Pricing", "How much will the repair cost?", "We give a quote after checking the car. Send us a short description and photos for a first estimate."],
    ["Availability", "Is this car or part available?", "Send us the item name and we'll confirm availability and the price."],
  ],
};

const ALIAS: Partial<Record<CanonicalBusinessType, CanonicalBusinessType>> = {
  Salon: "Beauty",
  Photography: "Professional Services",
  Agency: "Professional Services",
  Cleaning: "Professional Services",
  Construction: "Professional Services",
  "Software Development": "Professional Services",
  "HR & Recruitment": "Professional Services",
  Logistics: "Professional Services",
  Church: "Event Planning",
  "Travel & Tourism": "Event Planning",
  "Health & Fitness": "Health",
};

const COMMERCE_TYPES: CanonicalBusinessType[] = ["Fashion", "Electronics", "Retail", "Food & Groceries", "Home & Furniture", "Agriculture"];

const GENERAL: Seed[] = [
  ["General", "What do you offer?", "You can browse everything we offer on our store pages. Tell us what you're looking for and we'll point you to the right one."],
  ["Pricing", "How much does it cost?", "Prices are shown on each item. For anything custom, send us the details and we'll give you a quote."],
  ["Payments", "How can I pay?", "You'll see the available payment options at checkout. If you run into trouble paying, message us."],
  ["Location", "Where are you and when are you open?", "Our address and opening hours are on our Contact page."],
];

export function defaultFaqsFor(businessType: string | null | undefined): StoreFaq[] {
  const canonical = canonicalizeBusinessType(businessType);
  const key = ALIAS[canonical] ?? canonical;
  const seeds = COMMERCE_TYPES.includes(canonical) ? COMMERCE : SEEDS[key] ?? GENERAL;
  return seeds.map(([topic, question, answer], i) => ({ id: `d${i + 1}`, topic, question, answer, enabled: true }));
}

export function parseMessagingConfig(raw: unknown, businessType: string | null | undefined): MessagingConfig {
  const base: MessagingConfig = { autoReply: true, humanHandoff: true, faqs: defaultFaqsFor(businessType) };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const faqs = Array.isArray(r.faqs)
    ? (r.faqs as unknown[]).flatMap((f, i): StoreFaq[] => {
        if (!f || typeof f !== "object") return [];
        const o = f as Record<string, unknown>;
        const question = typeof o.question === "string" ? o.question.trim().slice(0, 200) : "";
        const answer = typeof o.answer === "string" ? o.answer.trim().slice(0, 1500) : "";
        if (!question || !answer) return [];
        return [{
          id: typeof o.id === "string" && o.id ? o.id.slice(0, 40) : `f${i}`,
          topic: (typeof o.topic === "string" && o.topic.trim() ? o.topic.trim() : "General").slice(0, 60),
          question,
          answer,
          enabled: o.enabled !== false,
        }];
      })
    : base.faqs;
  return { autoReply: r.autoReply !== false, humanHandoff: r.humanHandoff !== false, faqs };
}

const STOP = new Set(["the", "a", "an", "is", "are", "do", "does", "you", "your", "i", "my", "me", "can", "how", "what", "to", "of", "for", "and", "or", "it", "in", "on", "at", "we", "have", "will", "this", "that", "with", "please", "hi", "hello"]);

function tokens(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

/** Best FAQ for a free-text message, or null if nothing matches well enough. Exact question wins outright. */
export function matchFaq(message: string, faqs: StoreFaq[]): StoreFaq | null {
  const enabled = faqs.filter((f) => f.enabled);
  const norm = message.trim().toLowerCase();
  const exact = enabled.find((f) => f.question.trim().toLowerCase() === norm);
  if (exact) return exact;
  const words = new Set(tokens(message));
  if (words.size === 0) return null;
  let best: { faq: StoreFaq; score: number } | null = null;
  for (const f of enabled) {
    const fw = tokens(`${f.question} ${f.topic}`);
    if (fw.length === 0) continue;
    const hits = fw.filter((w) => words.has(w)).length;
    const score = hits / Math.min(fw.length, Math.max(words.size, 1));
    if (hits >= 2 && score >= 0.5 && (!best || score > best.score)) best = { faq: f, score };
  }
  return best?.faq ?? null;
}

export const HUMAN_REQUEST_REPLY = "Got it. I've asked a team member to take over this chat. They'll reply here as soon as they can.";
export const NO_MATCH_REPLY = "Thanks for your message! A team member will reply here soon. In the meantime you can tap one of the quick questions below, or choose \"Talk to a human\".";
