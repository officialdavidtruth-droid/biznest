import { PLAYBOOK_CARD, type PlaybookKey } from "@/lib/playbook-meta";
import { DEEP } from "@/lib/playbooks-deep";

/**
 * Niche ebooks ("playbooks") shown at /[slug]/admin/playbook.
 * Every niche shares the same 7-chapter journey (set up -> stock -> get paid ->
 * first sale -> market -> keep customers -> run it) but each chapter is written
 * in that niche's own language and examples. Plain serialisable data.
 *
 * Action paths are relative to /[slug]/admin; "catalog" resolves to
 * /products or /services depending on how the store sells.
 */
/** A named, repeatable money-making play with an optional worked example. */
export type Method = { title: string; how: string; example?: string };

export type PlaybookChapter = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  intro: string;
  steps: string[];
  methods?: Method[];
  /** Several copy-paste messages (each gets its own Copy button). */
  scripts?: { label: string; text: string }[];
  /** Things to avoid; shown as a red-flag list. */
  avoid?: string[];
  tip?: string;
  script?: { label: string; text: string };
  action?: { label: string; path: string };
};

export type Playbook = {
  key: PlaybookKey;
  title: string;
  tagline: string;
  cardTitle: string;
  chapters: PlaybookChapter[];
};

type Niche = {
  key: PlaybookKey;
  bookTitle: string;
  tagline: string;
  items: string; // what they list, plural
  customers: string;
  stock: string[];
  photoTip: string;
  pricingTip: string;
  delivers: boolean;
  abandoned: boolean;
  plan: string[]; // 7 days
  script: string;
  marketing: string[];
  retention: string[];
  routine: string[];
};

const NICHES: Niche[] = [
  {
    key: "food", bookTitle: "The Hot Orders Playbook", tagline: "Your first 10 food orders, then a queue of regulars.",
    items: "menu items", customers: "hungry customers",
    stock: ["Start with 8 to 12 best-sellers, not your whole kitchen. A short menu looks confident and is easier to run.", "Group items into clear categories (Rice, Grills, Drinks, Small chops) so people find things in seconds.", "Add sizes and extras as variants and add-ons (extra protein, plantain, pack of 3) because extras are where your profit hides.", "Mark anything that sells out as unavailable instead of deleting it, so you don't re-do the listing tomorrow."],
    photoTip: "Shoot in daylight near a window, from slightly above, with a clean plate and a plain background. One bright, close photo sells better than five dark ones.",
    pricingTip: "Price each dish from its real cost: ingredients, gas, packaging and your time. If you only cover ingredients, every order loses money.",
    delivers: true, abandoned: true,
    plan: ["Finish setup and place one order yourself from your phone, exactly as a customer would.", "Send your store link to 10 people who already know your food and ask them to order this week.", "Post your best dish photo on your WhatsApp status with the link and a clear call to action: Order here.", "Offer a launch deal, such as free drink with the first 20 orders, using a coupon code.", "Ask your first customers for a photo of their meal and permission to share it.", "Post the customer photo and a short review. Real people beat any advert.", "Count your orders, note your best-seller, and make it your featured item next week."],
    script: "Hello! My kitchen is now taking orders online. Pick your meal, choose delivery or pickup and pay in a minute: {link}. First 20 orders get a free drink with code {code}.",
    marketing: ["Post your WhatsApp status daily at lunch and dinner time, when people decide what to eat.", "Put your store link in your Instagram and TikTok bio and in every caption.", "Print a small card with your link for every delivery bag so each customer becomes a reorder.", "Partner with offices, hostels or estates: a group order with a shared delivery fee is easy money.", "Run a weekday special (Tuesday Jollof Day) so people have a reason to come back on a schedule."],
    retention: ["Ask every happy customer for a review right after delivery.", "Use coupons for a second-order discount instead of discounting your first order too deeply.", "Check Abandoned checkouts: someone who got as far as paying is nearly yours. Follow up quickly.", "Remember favourites. Message regulars when their favourite dish is back or a new one drops."],
    routine: ["Morning: update what is available today and post your status.", "Peak hours: keep your phone close and confirm orders fast.", "Evening: check Orders, mark everything delivered, ask for reviews.", "Weekly: open Analytics, find your best-seller and your slowest item, and adjust the menu."],
  },
  {
    key: "retail", bookTitle: "The Sell-Out Playbook", tagline: "From your first sale to products that keep selling out.",
    items: "products", customers: "shoppers",
    stock: ["Start with your 10 to 20 strongest products. Add the rest once your first orders are flowing.", "Give every product a clear name, honest description, size or colour options and accurate stock count.", "Use categories that match how people shop (Men, Women, Shoes) so browsing feels natural.", "Set low-stock alerts in Inventory so you never sell what you no longer have."],
    photoTip: "Use a plain light background and natural light. Show the front, the back and one close-up of the detail. If clothing, add one photo of it being worn.",
    pricingTip: "Price with your landing cost, delivery, packaging and a margin you can survive on. Cheapest is not a strategy; trusted and reliable is.",
    delivers: true, abandoned: true,
    plan: ["Finish setup and buy one item from your own store on your phone to see what shoppers see.", "Message 15 past customers or friends with your store link and a personal note.", "Post your three best products with prices and the link on your status and Instagram.", "Create a launch coupon and share it as a limited-time offer.", "Reply to every question quickly, then turn the common ones into product description details.", "Post a customer photo or review from your first orders.", "Review what sold, double down on it and feature it on your home page."],
    script: "Hi! My new online store is live: {link}. Browse, pay securely and get it delivered. Use {code} for a launch discount this week only.",
    marketing: ["Show new arrivals on your status twice a week with a link, not just a picture.", "Make short videos: unboxing, styling, or how the product is used.", "Collaborate with small creators and ask them to share one honest review.", "Bundle products (shirt plus cap) to raise the value of each order.", "Run limited drops with a clear end time to create urgency without fake claims."],
    retention: ["Ask for reviews after delivery and showcase the best ones.", "Use Abandoned checkouts to follow up with people who nearly bought.", "Reward repeat buyers with a coupon or gift card.", "Turn on referrals so happy customers bring friends."],
    routine: ["Daily: reply to messages and process new orders.", "Twice a week: post new or restocked products.", "Weekly: check Inventory for low stock and Analytics for top sellers.", "Monthly: retire slow items and reinvest in winners."],
  },
  {
    key: "beauty", bookTitle: "The Fully Booked Playbook", tagline: "Fill your diary with clients who come back.",
    items: "services", customers: "clients",
    stock: ["List your 6 to 10 most requested services first, each with a clear price and how long it takes.", "Describe the result, not just the task (Soft glam for events, 90 minutes) so clients know what they get.", "Set your working hours and breaks honestly so clients only book times you can keep.", "Add packages (bridal trial plus day-of) to raise the value of each booking."],
    photoTip: "Before-and-after photos with the client's permission are your strongest proof. Use consistent lighting and the same angle so the difference is obvious.",
    pricingTip: "Price by time and skill. If a service takes two hours, make sure the price pays for the full two hours plus setup and cleanup.",
    delivers: false, abandoned: false,
    plan: ["Finish setup and make a test booking from your phone to see the client experience.", "Message 10 past clients with your booking link and ask them to book their next visit.", "Post three of your best results with prices and your link.", "Offer a first-visit deal or a free add-on for new bookings this week.", "Confirm every booking quickly and send a short reminder the day before.", "Ask each client for a review and a photo, with permission, after the visit.", "Block out your quiet days and fill them with a midweek offer."],
    script: "Hi! You can now book me online in under a minute: {link}. Pick your service, choose a time that suits you and you're set. New clients get a free add-on with {code}.",
    marketing: ["Post transformation photos and a booking link every few days.", "Share quick tips (skin prep, hair care) that show your expertise and invite bookings.", "Fill quiet slots with limited midweek offers instead of lowering your everyday price.", "Partner with a photographer, planner or boutique for referrals.", "Put your booking link everywhere: bio, status, business card and signage."],
    retention: ["Rebook before the client leaves: suggest the next visit date.", "Send a reminder and a thank-you message after each appointment.", "Ask for reviews and show them on your store.", "Offer packages and gift cards so clients prepay and bring friends."],
    routine: ["Morning: check today's bookings and prepare.", "After each client: ask for a review and suggest the next visit.", "Weekly: look at Calendar for gaps and post an offer to fill them.", "Monthly: raise prices on your most-booked services when your diary stays full."],
  },
  {
    key: "stay", bookTitle: "The Full House Playbook", tagline: "Win your first bookings and keep rooms filled.",
    items: "rooms and experiences", customers: "guests",
    stock: ["Add every room type with honest capacity, price per night and what is included.", "List amenities guests actually search for: Wi-Fi, power backup, breakfast, parking and security.", "Write a short, specific description for each room instead of copying generic text.", "Add your location details and nearby landmarks so guests can picture the trip."],
    photoTip: "Photograph every room in daylight with the bed made and curtains open. Add the bathroom, the view and the entrance. Guests trust what they can see.",
    pricingTip: "Set a fair base rate and adjust for weekends and holidays. Do not copy competitors blindly: price for the value and comfort you really offer.",
    delivers: false, abandoned: false,
    plan: ["Finish setup, add all rooms and make a test booking from your phone.", "Message past guests and local companies with your booking link.", "Post your best room photos and one clear reason to book direct.", "Offer a direct-booking perk such as late checkout or a welcome drink.", "Reply to every enquiry within the hour; speed wins bookings.", "Ask your first guests for a review and a photo of their stay.", "Review your calendar and fill the gaps with a midweek rate."],
    script: "Hello! You can now book our rooms directly online: {link}. Book direct and enjoy a welcome perk with code {code}.",
    marketing: ["Post room tours and local experiences, not just rooms.", "Target events: weddings, conferences and festivals nearby need rooms.", "Partner with event planners, travel agents and corporate offices.", "Share guest reviews and real photos often.", "Offer direct-booking perks so guests skip middlemen."],
    retention: ["Send a thank-you and ask for a review after checkout.", "Offer past guests a return-stay discount.", "Reply to every review, good or bad, politely and quickly.", "Collect guest contacts (with permission) for seasonal offers."],
    routine: ["Daily: answer enquiries and confirm arrivals.", "Weekly: check upcoming occupancy and adjust rates for slow dates.", "After each stay: request a review.", "Monthly: update photos and refresh your best offers."],
  },
  {
    key: "services", bookTitle: "The Win Clients Playbook", tagline: "Land your first paying client and build a pipeline.",
    items: "services", customers: "clients",
    stock: ["List the 3 to 6 services you want to be known for, not everything you can do.", "For each service describe the problem you solve, what the client gets and roughly how long it takes.", "Use clear starting prices or packages so serious clients can self-qualify.", "Turn on quotes for custom work so clients can send you a full brief."],
    photoTip: "Show proof: past projects, results, logos of clients (with permission) or short case studies. Proof sells services better than adjectives.",
    pricingTip: "Price on value and time. Offer three packages (basic, standard, premium) so clients can choose without negotiating from zero.",
    delivers: false, abandoned: false,
    plan: ["Finish setup and send yourself a test quote request to see what clients see.", "Message 10 people in your network who could hire you or refer you.", "Post a short case study or result with your link.", "Offer a starter package or a free short consultation to your first clients.", "Follow up on every enquiry within a day with a clear next step.", "Send a professional invoice from BizNest as soon as work is agreed.", "Ask your first client for a testimonial and display it."],
    script: "Hi! I help {customers} with [your main service]. You can see what I do and request a quote here: {link}. Happy to answer any question.",
    marketing: ["Share useful tips in your field weekly; expertise attracts clients.", "Publish short case studies: problem, what you did, result.", "Join and contribute to groups where your ideal clients gather.", "Ask every happy client for a referral and a testimonial.", "Send direct, polite messages to businesses that clearly need your service."],
    retention: ["Deliver on time and over-communicate; reliability is your best marketing.", "Send invoices promptly and follow up on unpaid ones.", "Check in 30 days after a project with an offer for the next step.", "Ask for referrals when the client is happiest."],
    routine: ["Daily: reply to new enquiries and quote requests.", "Weekly: post one tip or case study and follow up on open quotes.", "After each project: request a testimonial.", "Monthly: review which service brings the best clients and promote it."],
  },
  {
    key: "creative", bookTitle: "The Book Me Playbook", tagline: "Turn followers and compliments into paid bookings.",
    items: "packages", customers: "clients",
    stock: ["Create 3 clear packages with price, hours or deliverables and what is included.", "Be specific: how many edited photos, how many hours, how many guests you can serve.", "Add a deposit rule so a date is only held once it is paid for.", "Show your availability so clients know which dates are open."],
    photoTip: "Your portfolio is your product. Show your 12 best pieces, grouped by type of job. Quality beats quantity every time.",
    pricingTip: "Price for the full job: prep, the event itself, editing, travel and revisions. Never price only the hours you are on site.",
    delivers: false, abandoned: false,
    plan: ["Finish setup and make a test booking or quote request from your phone.", "Message past clients and friends: tell them you now take bookings online.", "Post your three best pieces of work with a clear Book me link.", "Offer a limited date discount for the next quiet month.", "Reply to every enquiry fast with availability and package options.", "Secure each date with a deposit, then confirm details in writing.", "After the job, ask for a testimonial and permission to feature the work."],
    script: "Hi! I'm now taking bookings online for {customers}. See my packages and open dates here: {link}. A deposit holds your date.",
    marketing: ["Post behind-the-scenes and finished work every few days.", "Partner with venues, vendors and planners who can refer you.", "Share client stories (with permission) to prove you deliver.", "Offer seasonal mini-packages (holiday sessions, small events).", "Make your booking link the only call to action in your bio."],
    retention: ["Deliver early and communicate clearly.", "Ask for a testimonial and a referral right after delivery.", "Offer returning clients a loyalty rate.", "Follow up before anniversaries and seasons."],
    routine: ["Daily: answer enquiries and update availability.", "Weekly: post new work and follow up on open quotes.", "After each job: request a testimonial and referral.", "Monthly: update your portfolio with your best recent work."],
  },
  {
    key: "property", bookTitle: "The Close the Deal Playbook", tagline: "Get serious enquiries and turn viewings into deals.",
    items: "listings", customers: "buyers and renters",
    stock: ["List only properties you can actually show, with accurate price and location.", "Include size, rooms, key features, payment terms and what makes the place different.", "Be upfront about extra costs so only serious people enquire.", "Keep listings fresh: remove sold and rented ones quickly to protect trust."],
    photoTip: "Shoot in daylight with every room, the compound and the street. Wide, level, tidy photos build trust faster than any description.",
    pricingTip: "Price against comparable listings in the same area and be clear about all fees. Honest pricing attracts serious buyers.",
    delivers: false, abandoned: false,
    plan: ["Finish setup and list your best 3 properties completely.", "Share each listing link with people already looking for a place.", "Post one listing a day with a strong photo and a single clear call to action.", "Reply to every enquiry within an hour and offer viewing times.", "Prepare a clear checklist for viewings and follow up the same day.", "Send formal invoices and quotes for agreed fees.", "Ask satisfied clients for a testimonial and referrals."],
    script: "Hi! A new property just listed: {link}. Full details, photos and price are on the page. Message me to book a viewing.",
    marketing: ["Post one listing at a time with a story: who it suits and why.", "Share neighbourhood tips to show local expertise.", "Partner with movers, lawyers and surveyors for referrals.", "Run short video tours.", "Always give one clear next step: message to book a viewing."],
    retention: ["Follow up with every viewer, even those who don't commit.", "Keep a list of what each enquirer wants and message when a match appears.", "Ask closed clients for referrals.", "Stay in touch with landlords and owners for new listings."],
    routine: ["Daily: reply to enquiries and schedule viewings.", "Weekly: post fresh listings and update old ones.", "After each deal: request a testimonial.", "Monthly: review which areas and prices attract the most enquiries."],
  },
  {
    key: "community", bookTitle: "The Grow Together Playbook", tagline: "Events, giving and reach for your community.",
    items: "events and offers", customers: "members",
    stock: ["Publish your regular services and upcoming events with dates, times and location.", "Make it easy to give or register with one clear page and one clear action.", "Share your story and vision so new people know who you are.", "Add photos and short videos of past gatherings."],
    photoTip: "Show real people and real moments with their permission. A warm, honest photo of a gathering says more than a banner.",
    pricingTip: "Be transparent about where contributions go and what they achieve. Trust is what makes people give again.",
    delivers: false, abandoned: false,
    plan: ["Finish setup and publish your next event with full details.", "Share the link with your core members and ask each to invite two people.", "Post a short invite with date, place and link.", "Send a reminder two days before and the morning of.", "Welcome first-timers personally.", "Share a short thank-you and highlights after the event.", "Announce the next event and repeat."],
    script: "You're invited! Join us on [date] at [place]. Details and registration here: {link}. Bring someone with you.",
    marketing: ["Invite through personal messages; they work better than broadcast posts.", "Share testimonies and highlights from past events.", "Partner with other groups for joint events.", "Keep a consistent schedule so people can plan around you.", "Make registration or giving a one-tap action."],
    retention: ["Follow up with first-time visitors within 48 hours.", "Share regular updates on what contributions achieved.", "Recognise volunteers and members publicly.", "Keep a simple calendar members can rely on."],
    routine: ["Weekly: share the week's plan and reminders.", "After each event: share highlights and thank people.", "Monthly: report what was achieved.", "Quarterly: review what to start, stop and continue."],
  },
  {
    key: "general", bookTitle: "The First Sales Playbook", tagline: "How to make your first sale on BizNest and keep going.",
    items: "offers", customers: "customers",
    stock: ["Start with the 5 to 10 things you most want to sell, each with a clear name and price.", "Write one honest sentence about who it is for and what they get.", "Add accurate prices, options and availability.", "Organise into simple categories so people find things quickly."],
    photoTip: "Use bright natural light, a clean background and real photos of your own work. Clear beats fancy.",
    pricingTip: "Know your cost and the time it takes you, then price so each sale leaves a profit you are happy with.",
    delivers: true, abandoned: true,
    plan: ["Finish setup and try your store as a customer on your phone.", "Message 10 people who might buy and send your link.", "Post your best offer with the link on your status and socials.", "Create a launch coupon for your first customers.", "Reply to every message quickly and note common questions.", "Share a customer review or photo.", "Check what sold best and promote it harder."],
    script: "Hi! My business is now online. See what I offer and order here: {link}. Use code {code} for a launch discount.",
    marketing: ["Share your link everywhere people already find you.", "Post consistently with one clear call to action.", "Ask friends and customers to share your link.", "Run time-limited offers.", "Show real proof: reviews, photos, results."],
    retention: ["Ask every customer for a review.", "Thank people personally.", "Offer repeat customers a reward.", "Follow up with people who started but didn't finish."],
    routine: ["Daily: reply and process orders or bookings.", "Weekly: post, check Analytics and adjust.", "Monthly: review what worked and do more of it.", "Quarterly: raise prices or add offers as demand grows."],
  },
];


// ---------------------------------------------------------------------------
// Proven plays. These are standard, widely used small-business methods; none
// of them is a guarantee, and results depend on your product, price and effort.
// ---------------------------------------------------------------------------

const UNIVERSAL: Record<string, Method[]> = {
  open: [
    { title: "Pass the 10-second test", how: "Anyone landing on your store should know in 10 seconds: what you sell, who it is for, the price range and how to order. Put that in your top banner and first products." },
  ],
  stock: [
    { title: "Price with the margin formula", how: "Selling price = total cost ÷ (1 − the profit margin you want). Total cost means everything: ingredients or stock, packaging, delivery you absorb, payment fees and your time.", example: "Cost 1,000 and you want a 40% margin: 1,000 ÷ 0.6 = about 1,667. Pricing at 1,400 'because it looks fair' gives only about 29% margin, which is a big difference at 100 sales a month." },
    { title: "Offer three options, not one", how: "Show a basic, a standard and a premium option. Most buyers choose the middle one, and the premium makes it look reasonable. This raises what each customer spends without any extra advertising." },
  ],
  paid: [
    { title: "Get paid before you deliver", how: "Online payment at checkout removes no-shows, fake orders and chasing money. For custom or high-value work, ask for a deposit first (by invoice or transfer) and the balance before handover." },
    { title: "Show the full price early", how: "Surprise delivery or extra fees at the last step is a top reason shoppers leave. Show delivery cost on the product or cart and you will lose fewer buyers at checkout." },
  ],
  first: [
    { title: "The 20-message launch", how: "Write a personal message to 20 people who already know and trust you: past customers, friends, colleagues, neighbours. Send the link, say exactly what you want (order, book, or share) and follow up once after two days. Personal asks to warm contacts are the most reliable first-sale method there is.", example: "If just 4 of 20 say yes, that is 4 customers and 4 reviews before you spend anything on ads." },
    { title: "Reply within 10 minutes", how: "Buyers message several sellers at once and usually go with whoever answers first and clearly. Turn on notifications and keep ready-made answers for price, delivery, payment and availability." },
  ],
  market: [
    { title: "Offer + deadline + link", how: "Every promotion should have the same three parts: a specific offer, a clear end time and your store link. Vague posts ('we're open!') get likes; specific posts get orders.", example: "Weekend special: free drink with any 2 orders, ends Sunday 6pm. Order here: your link." },
    { title: "Turn every customer into content", how: "With permission, post customer photos, voice notes and reviews. People trust other buyers more than they trust you. Ask for the photo at delivery while they are happy." },
    { title: "Two-sided referral", how: "Give the person who refers a reward and give the new customer a welcome discount. When both sides win, people share. Set it up in Referrals and tell your best customers it exists." },
  ],
  return: [
    { title: "Ask for the review within 24 hours", how: "Ask right after delivery or the appointment, when satisfaction is highest. Make it one easy question and thank them personally. Reviews on your store lift every future sale." },
    { title: "Message before they need you again", how: "Know your natural repeat cycle (food: days, beauty: weeks, consumables: months) and message customers just before it ends with one easy way to reorder." },
    { title: "Win back almost-buyers", how: "Someone who reached checkout and left is warmer than any stranger. Follow up the same day with help, not pressure: 'Did anything go wrong with your order?' Use Abandoned checkouts where your business type has it." },
  ],
  run: [
    { title: "Pull the four levers", how: "Revenue = people who see your store × the share who buy × what each order is worth × how often they come back. Improving each lever by a little multiplies. Fix the weakest one first.", example: "If 10% more people see you, 10% more buy and each order is 10% bigger, revenue rises about 33%, not 30%, because they compound." },
    { title: "The weekly 15-minute numbers review", how: "Once a week, open Analytics and write down: number of orders or bookings, average order value, top three sellers and bottom three sellers. Promote the top, fix or drop the bottom. Keep what you measure simple so you actually do it." },
    { title: "Cut slow items, back winners", how: "Roughly a fifth of your offers usually bring most of your income. Find them in Analytics, feature them first, bundle around them and stop spending time on things that do not sell." },
  ],
};

const NICHE_METHODS: Record<PlaybookKey, Record<string, Method[]>> = {
  food: {
    first: [
      { title: "Cut-off pre-orders", how: "Take orders until a set time (for example 11am for lunch). Cook one batch, deliver in one run. You waste less food and spend less on riders, and demand becomes predictable." },
    ],
    market: [
      { title: "Win 2 or 3 offices or estates", how: "Pitch nearby offices, hostels or estates a weekly lunch plan or group order with one delivery fee. One office of 20 people can outsell a month of random walk-in traffic.", example: "10 staff ordering 3 days a week is 30 orders a week from one relationship." },
      { title: "Combos and add-ons", how: "Offer 'meal + drink + extra protein' as a combo. Add-ons are often your highest-margin items and raise every order. Feature your highest-margin dish first on the menu." },
    ],
    return: [
      { title: "Weekly meal plan packs", how: "Offer a Monday to Friday pack, ordered and paid on Sunday. You get cash upfront, steady demand and a customer who comes back every week." },
    ],
    run: [
      { title: "Party trays and bulk orders", how: "Small chops, party jollof and platters for events carry much larger order values. Take a deposit when the date is agreed and give a clear cut-off for changes." },
      { title: "Minimum order for free delivery", how: "Set free delivery above a spend slightly higher than your average order. Customers add an item to qualify, which lifts the order and covers the delivery." },
    ],
  },
  retail: {
    first: [
      { title: "Sell before you stock (pre-orders)", how: "For items you source on demand, show them as pre-order with an honest delivery window, take payment, then buy. You avoid dead stock and cash tied up in slow items. Keep your promised dates, or trust is gone.", example: "Test 5 new styles as pre-orders; only restock the 2 that sell." },
    ],
    market: [
      { title: "Wholesale price for resellers", how: "Create a price for people who buy 10 or more pieces. Resellers sell for you in their own networks, giving you bigger orders and fewer customers to serve." },
      { title: "Bundles with a free-delivery threshold", how: "Pair products that go together (shirt + cap, phone + case) and offer free delivery above a basket size. This raises order value and covers shipping.", example: "If your average order is 4,000 and bundles lift it to 5,000, then 100 orders a month earns 100,000 more." },
    ],
    return: [
      { title: "Plan stock around the calendar", how: "Back-to-school, Valentine's, Sallah, Black Friday and December are predictable peaks. Order stock 6 to 8 weeks early and announce restock dates so shoppers come ready to buy." },
    ],
    run: [
      { title: "Protect your cash flow", how: "Reorder winners in small batches and track stock in Inventory. Cash trapped in slow stock is the number one reason small shops struggle even when they sell." },
    ],
  },
  beauty: {
    first: [
      { title: "Deposit to hold the slot", how: "A small deposit (by invoice or transfer) per booking sharply cuts no-shows and late cancellations. Tell clients up front: the deposit holds your time." },
    ],
    market: [
      { title: "Fill quiet days, not discount busy ones", how: "Look at your calendar for gaps and run a midweek offer only for those slots. Your busy days stay at full price and your empty hours earn." },
      { title: "Before-and-after proof", how: "With consent, post transformations with the service name and booking link. Clients choose providers whose results they can see." },
    ],
    return: [
      { title: "Rebook before they leave", how: "At the end of every appointment, suggest the next date based on how often the service is needed and book it there and then. This single habit is the cheapest way to fill your diary.", example: "A client who comes every 4 weeks is worth about 13 visits a year." },
      { title: "Prepaid packages", how: "Sell 5 sessions at a small discount, paid upfront. You collect cash earlier and the client is committed to come back." },
    ],
    run: [
      { title: "Add-on upsell at booking", how: "Offer one relevant add-on when someone books (deep conditioning, lash fill, scalp massage). A small add-on on most bookings adds up fast." },
      { title: "Event seasons", how: "Weddings, graduations and festive periods fill diaries. Open event slots early, require deposits and offer bridal or group packages." },
    ],
  },
  stay: {
    first: [
      { title: "Corporate rates with nearby companies", how: "Visit or message 5 to 10 companies, hospitals, schools and event venues nearby. Offer a corporate rate for guests and training stays. A few corporate accounts fill the quiet midweek nights." },
    ],
    market: [
      { title: "Direct-booking perks", how: "Offer something small only for direct bookings (late checkout, breakfast, a welcome drink). You keep the guest relationship and avoid relying on middlemen." },
      { title: "Partner with event planners and venues", how: "Weddings, conferences and funerals bring out-of-town guests who need rooms. Give planners an easy way to book blocks of rooms." },
    ],
    return: [
      { title: "Upsell the stay", how: "Offer breakfast, airport pickup, late checkout, extra bed or a meeting room. These add-ons often cost you little and add real revenue to each stay." },
    ],
    run: [
      { title: "Weekday and weekend rates", how: "Charge more for peak weekends and holidays, offer midweek rates to fill gaps. Review your calendar each week and adjust ahead of slow dates." },
      { title: "Day-use and meeting space", how: "Rooms or halls empty in the daytime can earn as day-use rooms or small meeting spaces for people who need a quiet place to work." },
    ],
  },
  services: {
    first: [
      { title: "Productise your service", how: "Turn what you do into 3 fixed packages with a clear scope, timeline and price. Clients buy faster when they can see exactly what they get, and you stop pricing from scratch every time.", example: "Basic, Standard and Premium packages with a clear deliverable list beat 'contact me for a quote'." },
      { title: "Free mini-audit as a door opener", how: "Offer a short, specific review of the client's current situation (their website, books, process, site) and show what you would fix. It proves skill and creates a natural next step." },
    ],
    market: [
      { title: "Case studies that prove results", how: "Write a one-page story for each client: the problem, what you did and the result in numbers if possible. Case studies sell services better than any description." },
    ],
    paid: [
      { title: "50% upfront, balance on delivery", how: "Send an invoice for part of the fee before starting and the rest before handing over final files or results. It filters out time-wasters and protects your cash flow." },
    ],
    return: [
      { title: "Move clients to monthly retainers", how: "When a project ends, offer ongoing support for a fixed monthly fee. Recurring income is easier to plan around than one-off jobs." },
    ],
    run: [
      { title: "Send the proposal within 24 hours", how: "Speed signals professionalism. A clear one-page proposal with scope, price and start date, sent quickly, beats a perfect one sent a week later." },
    ],
  },
  creative: {
    first: [
      { title: "Deposit holds the date", how: "A date is not booked until the deposit is paid. This protects you from last-minute cancellations and turns 'maybe' into a commitment." },
    ],
    market: [
      { title: "Cross-referral partners", how: "Team up with makeup artists, planners, venues and caterers who serve the same clients. Agree to recommend each other. One strong partner can send you a steady stream of bookings." },
      { title: "Mini-sessions on set dates", how: "Run short, fixed-price sessions on specific days (holiday mini-shoots, small events). You batch your work, fill your calendar and attract clients who may later book bigger jobs." },
    ],
    return: [
      { title: "Add-ons that raise the invoice", how: "Offer extras: additional hours, more edited photos, prints, an album, a same-day preview. Many clients say yes at booking time, so raise average job value without more clients." },
    ],
    run: [
      { title: "Niche down to charge more", how: "Specialising (weddings, corporate headshots, birthday parties) lets you show a focused portfolio and charge more than a generalist. Pick the type of job you like and are best at." },
      { title: "Peak-season pricing", how: "Wedding and festive seasons carry higher demand. Raise prices and open dates early with deposits rather than discounting when you are already busy." },
    ],
  },
  property: {
    first: [
      { title: "Respond in minutes and qualify", how: "Reply fast and ask three questions: budget, timeline and must-haves. This saves viewings on people who cannot buy and lets you focus on serious prospects." },
    ],
    market: [
      { title: "One listing, one story", how: "Post one property at a time and say who it suits (young family, first-time renter, small business) and why. Specific audiences respond better than generic 'beautiful property' posts." },
      { title: "Batch your viewings", how: "Schedule several viewings on the same day and area. You save travel time and create a competitive atmosphere that helps buyers decide." },
    ],
    return: [
      { title: "Keep a want-list", how: "Note what each enquirer wants. When a matching property comes in, message them first. This turns past enquiries into your best leads." },
    ],
    run: [
      { title: "Build landlord relationships", how: "Landlords and owners who trust you give you new listings and exclusive mandates. Offer property-management or tenant-finding as a service for a recurring fee." },
      { title: "Put everything in writing", how: "Agree fees, terms and responsibilities in writing and follow your local rules for agents and agreements. Clear paperwork protects you and the client." },
    ],
  },
  community: {
    first: [
      { title: "Personal invitations", how: "Ask each core member to personally invite two people. One-to-one invitations work far better than general announcements." },
    ],
    market: [
      { title: "Fund projects with visible goals", how: "People give more readily to a specific, named goal with a target and progress updates than to a general appeal. Show what has been achieved and thank donors publicly where appropriate." },
    ],
    return: [
      { title: "Follow up first-timers within 48 hours", how: "A personal message after someone's first visit is the single biggest factor in whether they return. Make it warm and simple." },
    ],
    run: [
      { title: "Keep a regular event rhythm", how: "A predictable calendar (weekly gathering, monthly special event) builds habits. Publish it ahead of time and keep registration simple." },
      { title: "Report back", how: "Share a regular summary of what was achieved with the support received. Transparency builds the trust that sustains giving." },
    ],
  },
  general: {
    first: [
      { title: "Start with one clear offer", how: "Pick your most wanted product or service and promote just that for your first week. A focused message is easier to understand and easier to share than a long list." },
    ],
    market: [
      { title: "Show proof, not promises", how: "Real photos, real reviews and real results beat claims. Share them regularly." },
    ],
    return: [],
    run: [
      { title: "Raise prices gradually", how: "When demand is steady and you are close to full capacity, raise prices on your best sellers by 5 to 10%. If sales hold, the extra goes straight to profit." },
    ],
  },
};

function fill(text: string, n: Niche) {
  return text.replace("{customers}", n.customers);
}

function build(n: Niche): Playbook {
  const deep = DEEP[n.key];
  const chapters: PlaybookChapter[] = [
    {
      id: "open", title: "Open for business", minutes: 4,
      summary: "Set up your store so people trust it at first sight.",
      intro: "Before anyone buys, they decide in seconds whether your business looks real. These steps make that decision easy.",
      steps: ["Add your business name, logo and contact details in Settings.", "Complete Verification so customers see you are a real, trusted business.", "Pick a template that suits your niche, then personalise colours and pictures in Customize.", "Open your store link on your phone and check that it looks right to a stranger."],
      tip: "Verified, clear, good-looking stores convert better. Do this chapter first, even if you are in a hurry.",
      action: { label: "Open Settings", path: "/settings" },
    },
    {
      id: "stock", title: `Stock your ${n.items}`, minutes: 6,
      summary: `Add your ${n.items} the way ${n.customers} like to see them.`,
      intro: `Your ${n.items} are the heart of your store. Make them clear, honest and easy to choose.`,
      steps: [...n.stock, `Photos: ${n.photoTip}`, `Pricing: ${n.pricingTip}`],
      action: { label: `Add your ${n.items}`, path: "catalog" },
    },
    {
      id: "paid", title: "Get paid without stress", minutes: 4,
      summary: "Make payment simple for buyers and safe for you.",
      intro: "A sale is only real when the money reaches you. Set this up once and then forget about it.",
      steps: ["Open Payments and confirm how you get paid out.", "Check your bank details carefully so payouts go to the right account.", ...(n.delivers ? ["Set your delivery areas and prices in Delivery so shoppers see the cost at checkout."] : []), "Place one small order from your own store and follow it through, so you know exactly what customers experience."],
      tip: "Trust grows when buyers see clear prices, clear delivery costs and a smooth checkout. Surprises kill sales.",
      action: { label: "Open Payments", path: "/payments" },
    },
    {
      id: "first", title: "Your first sale in 7 days", minutes: 6,
      summary: "A day-by-day plan to make that first sale happen.",
      intro: "Your first sale rarely comes from strangers. It comes from people who already know you. Follow this plan, one small action a day.",
      steps: n.plan.map((p, i) => `Day ${i + 1}: ${p}`),
      script: { label: "Copy-and-send message", text: fill(n.script, n) },
      tip: "Your store link is filled in for you. Swap [your coupon code] for a code you create, and fill anything in [brackets], before sending. Personal messages beat group blasts.",
      action: { label: "Create a launch coupon", path: "/coupons" },
    },
    {
      id: "market", title: "Marketing that costs almost nothing", minutes: 5,
      summary: "Free and cheap ways to get people to your store.",
      intro: "You do not need a big budget. You need a clear message, a consistent habit and one link to click.",
      steps: n.marketing,
      tip: "Every post needs one call to action and one link. Don't make people hunt for how to buy.",
      action: { label: "Set up referrals", path: "/referrals" },
    },
    {
      id: "return", title: "Turn buyers into regulars", minutes: 4,
      summary: "Reviews, rewards and follow-ups that bring people back.",
      intro: "It costs far less to sell again to a happy customer than to find a new one. Make coming back easy.",
      steps: n.retention,
      action: { label: "See your reviews", path: "/reviews" },
    },
    {
      id: "scripts", title: "Copy-paste scripts", minutes: 4,
      summary: "Messages for follow-ups, price pushback, reviews and win-backs.",
      intro: "Most sales are won or lost in the messages after the first hello. Save these, fill in the brackets and reply in seconds instead of staring at a blank screen.",
      steps: ["Save these messages in your phone notes or quick replies.", "Replace every [bracket] with real details before you send.", "Send a follow-up to everyone who has not replied after two days."],
      scripts: deep.scripts,
      tip: "Sound like yourself. Change the words so they feel like you, but keep the structure: be specific, be helpful and make the next step obvious.",
    },
    {
      id: "mistakes", title: "Mistakes that quietly cost sales", minutes: 3,
      summary: "The common leaks in your niche, and how to plug them.",
      intro: "You can avoid most of the losses other businesses in your niche suffer. Read these once, then check your own store against them.",
      steps: ["I have checked my store and routine against this list and fixed what I can."],
      avoid: deep.mistakes,
    },
    {
      id: "run", title: "Run it like a pro", minutes: 4,
      summary: "A simple routine, and the numbers worth watching.",
      intro: "Growth is mostly consistency. A small routine done every week beats a big push once in a while.",
      steps: [...n.routine, "Invite your team in Staff and give each person only the areas they need.", "Use Analytics weekly: find what sells best, do more of it and drop what doesn't."],
      tip: "You have the tools. The businesses that win are the ones that keep showing up.",
      action: { label: "Open Analytics", path: "/analytics" },
    },
    {
      id: "plan", title: "Your 30-day money plan", minutes: 3,
      summary: "Four weeks, one clear goal each.",
      intro: "Run this plan once, honestly, and you will know what works for your business. Tick each week off as you finish it.",
      steps: deep.plan30,
      tip: "Don't skip the weekly review. The numbers you note each Friday are what make month two better than month one.",
      action: { label: "Open your dashboard", path: "" },
    },
  ];
  for (const ch of chapters) {
    const own = ch.id === "run" ? [deep.breakeven] : [];
    ch.methods = [...own, ...(deep.extra[ch.id] ?? []), ...(NICHE_METHODS[n.key]?.[ch.id] ?? []), ...(UNIVERSAL[ch.id] ?? [])];
  }
  return { key: n.key, title: n.bookTitle, tagline: n.tagline, cardTitle: PLAYBOOK_CARD[n.key].title, chapters };
}

const BY_KEY = new Map<PlaybookKey, Playbook>(NICHES.map((n) => [n.key, build(n)]));

export function getPlaybook(key: PlaybookKey): Playbook {
  return BY_KEY.get(key) ?? BY_KEY.get("general")!;
}
