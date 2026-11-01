import type { PlaybookKey } from "@/lib/playbook-meta";

/**
 * Deeper layer for each niche playbook: copy-paste scripts, the mistakes that
 * quietly cost sales, a worked break-even calculation, a 30-day plan and extra
 * plays for the core chapters. Numbers in examples are illustrations only.
 */
export type DeepMethod = { title: string; how: string; example?: string };
export type Deep = {
  scripts: { label: string; text: string }[];
  mistakes: string[];
  breakeven: DeepMethod;
  plan30: string[];
  extra: Partial<Record<string, DeepMethod[]>>;
};

export const DEEP: Record<PlaybookKey, Deep> = {
  food: {
    scripts: [
      { label: "Follow-up (no reply after 2 days)", text: "Hi [name], just checking you saw my message. Today's special is [dish], ready by [time]. Order here: {link}" },
      { label: "When they say it's too expensive", text: "Thanks for asking! Every plate is cooked fresh to order with [quality point, e.g. fresh ingredients, generous portion]. If you want something lighter, try [cheaper item] at [price]: {link}" },
      { label: "Ask for a review", text: "Hi [name], hope you enjoyed your [dish]! Could you reply with one line on how it was? It really helps other people trust us. Thank you!" },
      { label: "Win back a customer", text: "Hi [name], we miss you! [Favourite or new dish] is back this week. Order today and get [small perk]: {link}" },
      { label: "Ask for a referral", text: "So glad you loved it! Send a friend to {link} and you both get [reward] on your next order." },
    ],
    mistakes: ["A huge menu. It slows your kitchen, increases waste and makes choosing harder. Start with your best 8 to 12.", "Pricing from ingredients only. Gas, packaging, delivery and your time must be in the price.", "No cut-off times. Orders pile up at peak hour, food arrives late and reviews suffer.", "Weak packaging. Food that arrives spilled or cold costs you the reorder, however good it tasted.", "Slow confirmation. Customers who wait 30 minutes for a reply often order elsewhere.", "Promising delivery times you cannot keep. Give a realistic window and beat it."],
    breakeven: { title: "Know your break-even", how: "Break-even orders = monthly fixed costs ÷ profit per order. Profit per order = average order value − what it costs you to make and deliver it. Work it out once and you know exactly what a good month looks like.", example: "Fixed costs 150,000 a month. Average order 4,000, and ingredients, packaging and delivery cost 2,600, so profit is 1,400 per order. 150,000 ÷ 1,400 is about 108 orders a month, roughly 4 a day. Every order after that is profit." },
    plan30: ["Week 1: Finish setup, place a test order, send the 20-message launch and aim for your first 3 orders.", "Week 2: Aim for 10 orders in total. Test a cut-off time and pitch 2 offices or estates.", "Week 3: Launch a combo and a weekly meal pack. Collect at least 5 customer reviews or photos.", "Week 4: Open Analytics, drop your slowest dish, feature your best-seller and set next month's target about 25% higher."],
    extra: {
      open: [{ title: "State your hours and cut-offs", how: "Put ordering hours, cut-off times and delivery areas where customers see them first. Clear rules prevent most complaints before they start." }],
      stock: [{ title: "Menu engineering: know your four types", how: "Sort dishes by popularity and profit. Stars (popular, high profit): feature them. Workhorses (popular, low profit): nudge the price up or trim the cost. Puzzles (unpopular, high profit): photograph better and rename. Dogs (neither): remove them.", example: "A popular dish earning 300 profit per plate sells 100 a month for 30,000 profit. Raising its price so it earns 350 and still sells 100 adds 5,000 a month with no new customers." }],
      paid: [{ title: "Packaging that protects your reviews", how: "Use containers that stay sealed, keep sauces separate and label each bag with the order number. Add a short thank-you note with your link. Good packaging is cheap marketing." }],
      first: [{ title: "Sample the right people", how: "Give a free small portion or taster to a few well-connected people in your area (a church leader, a hostel rep, an office manager) in exchange for an honest word-of-mouth recommendation." }],
      market: [{ title: "Daily rhythm on your status", how: "Post three times a day: late morning (lunch special), mid-afternoon (behind the scenes, preparation) and early evening (dinner special with a deadline). Always include the link." }],
    },
  },
  retail: {
    scripts: [
      { label: "Follow-up (no reply after 2 days)", text: "Hi [name], still thinking about the [product]? I only have [number] left in [size/colour]. Order here whenever you're ready: {link}" },
      { label: "When they say it's too expensive", text: "I understand! This one is [quality point, e.g. durable, original, comes with warranty] and you can return it if [policy]. If your budget is lower, [cheaper alternative] is a good option at [price]: {link}" },
      { label: "Ask for a review", text: "Hi [name], your [product] should have reached you. How are you finding it? If you're happy, a quick review or photo would mean a lot. Thank you!" },
      { label: "Win back a customer", text: "Hi [name], new arrivals just landed, including [product that matches what they bought]. As a returning customer, use [code] for [perk]: {link}" },
      { label: "Pitch a reseller", text: "Hi [name], I supply [product type] at wholesale prices for 10 or more pieces. You can resell at your own price. Want the price list? Start here: {link}" },
    ],
    mistakes: ["Buying lots of stock before testing demand. Start with a few styles and reorder what sells.", "Poor photos. Dark, cluttered pictures cost you more sales than a higher price ever will.", "No clear return or exchange policy. Buyers hesitate when they cannot tell what happens if it goes wrong.", "Not tracking stock. Selling something you no longer have breaks trust and refunds cost you.", "Discounting too early and too deep. Train customers to wait for sales and your margin disappears.", "Slow replies. Shoppers compare quickly and buy from whoever answers first."],
    breakeven: { title: "Know your break-even", how: "Break-even orders = monthly fixed costs ÷ profit per order, where profit per order = average order value − product cost, packaging and delivery you pay.", example: "Fixed costs 120,000 a month. Average order 12,000, and product, packaging and delivery cost 8,000, so profit is 4,000 per order. 120,000 ÷ 4,000 = 30 orders a month, about one a day. Raising average order value to 14,000 with bundles cuts that to 20 orders." },
    plan30: ["Week 1: Finish setup, list your best 10 to 20 products, send the 20-message launch and aim for your first 3 sales.", "Week 2: Aim for 10 sales. Create a bundle and a free-delivery threshold. Post a product daily.", "Week 3: Test 2 to 3 new items as pre-orders. Collect 5 reviews. Offer a reseller price.", "Week 4: Open Analytics and Inventory, reorder your winners, stop restocking slow items and set a target about 25% higher."],
    extra: {
      open: [{ title: "Add trust signals", how: "State your delivery time, return policy and contact options clearly. A new store with clear policies feels safer than a bigger store with vague ones." }],
      stock: [{ title: "Build an 80/20 product mix", how: "Keep a few 'hero' products that bring people in, a few higher-margin products that make your profit, and low-priced add-ons that raise every order.", example: "A hero phone at a slim margin brings the buyer; the case, screen guard and earphones add the profit." }],
      paid: [{ title: "A clear return policy increases sales", how: "Say in one sentence what you accept back and for how long. Buyers who know the rules buy more confidently, and fewer of them ask before ordering." }],
      first: [{ title: "Sell where your buyers already are", how: "Post products with prices in the places your friends and followers already spend time. One clear product per post with the link beats a long catalogue dump." }],
      market: [{ title: "Run a limited drop", how: "Release a small batch (for example 15 pieces) with a real end time and a count that updates. Real scarcity, honestly shown, brings people off the fence." }],
    },
  },
  beauty: {
    scripts: [
      { label: "Reminder (day before)", text: "Hi [name], this is a reminder of your [service] tomorrow at [time]. Reply YES to confirm. If you need to change it, please tell me before [time] so I can offer the slot to someone else." },
      { label: "Rebooking nudge", text: "Hi [name], it's been [number] weeks since your [service]. Your hair/skin/nails are due for a refresh. I have these slots: [options]. Book here: {link}" },
      { label: "When they say it's too expensive", text: "Thank you for asking! The price covers [time, products used, skill/experience]. If you'd like to start smaller, [cheaper service] is [price] and gives [result]: {link}" },
      { label: "Ask for a review", text: "Hi [name], thank you for visiting! If you loved your [service], could you leave a short review or send a photo I can share (only if you're happy)? It really helps." },
      { label: "Win back a lapsed client", text: "Hi [name], it's been a while! This month I'm offering [perk] for returning clients. Pick a slot here: {link}" },
    ],
    mistakes: ["Underpricing to win clients. You end up overworked and unable to cover your costs.", "No deposit. Without one, no-shows leave you with empty, unpaid hours.", "Unclear service durations. Overlapping appointments stress you and annoy clients.", "No cancellation policy. Without a clear rule, last-minute changes cost you money.", "Posting irregularly. Clients need regular proof that you are active and good.", "Letting clients leave without rebooking. The best time to book the next visit is before they go."],
    breakeven: { title: "Know your break-even (and your hourly value)", how: "Break-even bookings = monthly costs ÷ profit per booking. Then work out your hourly value: income you want ÷ billable hours you can really work.", example: "Costs 100,000 a month (products, tools, rent share). Average service 12,000, with 2,000 product and transport cost, so 10,000 profit per booking. 100,000 ÷ 10,000 = 10 bookings covers your costs, and everything after is your income. To earn 300,000 over 80 billable hours a month, your time must earn at least 3,750 an hour." },
    plan30: ["Week 1: Finish setup, list your top services with durations and prices, send the 20-message launch and book your first 3 clients.", "Week 2: Aim for 10 bookings. Add a deposit rule and a cancellation policy. Post 3 results.", "Week 3: Launch one midweek offer for quiet slots. Sell a 5-session package. Ask every client to rebook before leaving.", "Week 4: Check Calendar for gaps, collect reviews, raise the price of your most-booked service slightly and set next month's goal."],
    extra: {
      open: [{ title: "Show duration and price clearly", how: "Every service should show how long it takes and what it costs. Clients who can plan their time and money book more readily." }],
      stock: [{ title: "Price by the hour you really work", how: "Include setup, cleaning, products and the time between clients. A service that looks like 1 hour often uses 1.5.", example: "If you can only bill 20 hours a week, those hours must carry your whole income and costs, so the price per hour must reflect that." }],
      paid: [{ title: "State your cancellation policy", how: "One clear sentence on your booking page and in your confirmation message: for example, deposits are non-refundable for cancellations within 24 hours. Most clients respect clear rules." }],
      first: [{ title: "Model days", how: "Offer a few discounted or free appointments to people who will post their results and tag you. Choose people whose followers are the kind of clients you want." }],
      market: [{ title: "Teach in short videos", how: "Share a 30-second tip (skin prep, hair care, nail care) every few days, and end with your booking link. Expertise builds trust and attracts clients ready to pay." }],
    },
  },
  stay: {
    scripts: [
      { label: "Reply to an enquiry (fast)", text: "Hello [name], thank you for asking! For [dates] we have [room types and prices] available, including [key perks]. You can book instantly here: {link}. Would you like me to hold a room for a few hours?" },
      { label: "Follow-up (no reply)", text: "Hi [name], just checking whether you'd like to confirm your stay for [dates]. Rooms for that period are filling up. Book direct here for [perk]: {link}" },
      { label: "When they compare with another site", text: "Great question. Booking direct with us gets you [perk, e.g. late checkout, breakfast, flexible changes] that you won't get elsewhere, and the same room: {link}" },
      { label: "Ask for a review", text: "Hi [name], thank you for staying with us! We'd love to hear how it was. A short review helps future guests, and we read every one. We hope to see you again." },
      { label: "Pitch a company", text: "Hello [name], we offer corporate rates for guests and visiting teams, with [perks: Wi-Fi, breakfast, meeting space, airport pickup]. May I send you our rate sheet? Book or enquire here: {link}" },
    ],
    mistakes: ["Slow replies to enquiries. Guests message several places and book the first helpful answer.", "One flat rate all year. You leave money on the table at peaks and stay empty at quiet times.", "Poor photos or outdated pictures. Guests who feel misled leave bad reviews.", "Hidden fees. Surprise charges at check-in destroy trust and ratings.", "No reason to book direct. If direct is not clearly better, guests use the middleman.", "Ignoring reviews. Answering politely, especially to complaints, shows future guests you care."],
    breakeven: { title: "Know your break-even occupancy", how: "Break-even room-nights = monthly fixed costs ÷ profit per occupied night, where profit per night = average room rate − what each occupied night costs you (cleaning, laundry, utilities, breakfast). Divide by your total room-nights to get the occupancy you need.", example: "Fixed costs 2,000,000 a month. Average rate 30,000, with 6,000 cost per occupied night, so 24,000 profit per night. 2,000,000 ÷ 24,000 is about 84 room-nights. With 10 rooms you have about 300 room-nights a month, so you need roughly 28% occupancy to break even." },
    plan30: ["Week 1: Finish setup, list every room with real photos, send your link to past guests and companies, and aim for your first booking.", "Week 2: Add a direct-booking perk. Pitch 5 to 10 nearby companies and 2 event planners.", "Week 3: Add upsells (breakfast, pickup, late checkout). Set weekday and weekend rates. Ask each guest for a review.", "Week 4: Review occupancy by date, fill gaps with midweek offers, reply to every review and set the next month's occupancy goal."],
    extra: {
      open: [{ title: "Answer every guest question on the page", how: "List check-in and check-out times, location and landmarks, parking, power backup, Wi-Fi, breakfast and cancellation rules. Every unanswered question is a lost booking." }],
      stock: [{ title: "Sell the benefit, not the building", how: "Lead each room description with what the guest cares about: quiet, reliable power, strong Wi-Fi, comfortable bed, easy access to [landmark]. Features sell; adjectives don't." }],
      paid: [{ title: "Set a clear deposit and cancellation rule", how: "A deposit confirms the booking and a written cancellation rule protects your income when plans change. Put it where guests book, not in the fine print." }],
      first: [{ title: "Use the local calendar", how: "List events nearby (weddings, conferences, school graduations, festivals, sports) and contact organisers early. Guests from out of town need rooms close to the event." }],
      market: [{ title: "Make your reviews work for you", how: "Show your best guest reviews and real photos regularly. People booking a stay read reviews before they read your description." }],
    },
  },
  services: {
    scripts: [
      { label: "Cold outreach", text: "Hi [name], I noticed [specific thing about their business]. I help [type of client] with [result you deliver], and I think I can [specific benefit] for you. Here is what I do and how to get a quote: {link}. Happy to share a quick free suggestion first." },
      { label: "Proposal follow-up", text: "Hi [name], following up on the proposal I sent on [date]. Do you have any questions, or would you like me to adjust the scope or timing? I can start on [date] once we agree." },
      { label: "When they say it's too expensive", text: "I understand. The price covers [scope, results, experience]. If the budget is tight, we can start with a smaller package: [package name] for [price], then add the rest later: {link}" },
      { label: "Ask for a testimonial", text: "Hi [name], thank you for working with me. Could you share two or three lines on the problem you had and how it turned out? I'd love to feature it, with your permission." },
      { label: "Ask for a referral", text: "I'm glad you're happy with the result. Do you know one or two people or businesses facing something similar? An introduction would mean a lot: {link}" },
    ],
    mistakes: ["Pricing by the hour with no defined scope. Work grows and the pay does not.", "Starting without a deposit or written agreement. Unpaid work is the most expensive kind.", "Slow replies and slow proposals. The first professional answer often wins the client.", "Trying to serve everyone. A clear speciality is easier to refer and to charge more for.", "No case studies. Prospects need proof that you have solved their problem before.", "Not following up. Many sales happen on the second or third message."],
    breakeven: { title: "Work backwards from the income you want", how: "Needed revenue = monthly costs + the income you want. Divide by your average project value to see how many clients you must win, then by your close rate to see how many conversations that takes.", example: "Costs 150,000 and income target 400,000 means 550,000 needed. With an average project of 100,000 that is about 6 projects. If 1 in 4 proposals is accepted, you need around 24 proposals a month. Two retainers at 150,000 would cover over half of it before you start." },
    plan30: ["Week 1: Finish setup, define 3 packages with scope and price, send the 20-message launch and aim for 3 real conversations.", "Week 2: Send proposals within 24 hours. Offer a free mini-audit to 5 target prospects.", "Week 3: Write one case study. Ask your first client for a testimonial and a referral. Send invoices on time.", "Week 4: Offer a retainer to past clients, review which package sells best, and set next month's goals."],
    extra: {
      open: [{ title: "Make your ideal client obvious", how: "Write one line that says who you help and with what: for example, 'I help small restaurants get their first online orders.' Specific beats broad." }],
      stock: [{ title: "Write a scope box for every package", how: "List what is included, what is not, how many revisions you allow and how long it takes. This prevents scope creep and arguments later." }],
      paid: [{ title: "Put payment terms in writing", how: "State when invoices are due and what happens when they are late. Send the invoice from BizNest as soon as the work is agreed, and follow up politely on the due date." }],
      first: [{ title: "Walk your referral chain", how: "Ask your first 10 contacts: who do you know who needs [your service]? Warm introductions convert far better than cold messages." }],
      market: [{ title: "Be useful in public", how: "Post one practical tip each week that solves a small problem for your ideal client. People hire those who have already helped them think." }],
    },
  },
  creative: {
    scripts: [
      { label: "Reply to an enquiry", text: "Hi [name], thank you for thinking of me! For [type of job] I offer [package names and prices]. For [date], I'm [available/limited]. See what's included and book here: {link}. A deposit holds your date." },
      { label: "Follow-up (no reply)", text: "Hi [name], just checking in. I still have [date] available but I'm getting other enquiries. Would you like me to hold it for you? You can confirm here: {link}" },
      { label: "When they say it's too expensive", text: "I understand. My price includes [prep, hours, editing, deliverables]. If your budget is lower, my [smaller package] gives you [what they get] for [price]: {link}" },
      { label: "Ask for a testimonial", text: "Hi [name], thank you again for trusting me with [the event/shoot]. If you're happy with the result, would you write two or three lines about your experience? It helps people book with confidence." },
      { label: "Anniversary / return client", text: "Hi [name], it's almost a year since [the event]. If you're planning something new, I'd love to be part of it. Returning clients get [perk]: {link}" },
    ],
    mistakes: ["Underpricing. You cannot afford better equipment, and clients read low prices as low quality.", "No deposit. A date that costs nothing to cancel is easy to cancel.", "Vague deliverables. Say how many hours, photos or edits are included.", "No contract or usage terms. Agree usage rights, delivery date and revisions in writing.", "Late delivery. Reliability is what earns referrals.", "A portfolio that shows everything. Show your best work in the niche you want more of."],
    breakeven: { title: "Know your break-even jobs", how: "Needed revenue = monthly costs (equipment, software, transport, marketing) + the income you want. Divide by average job value, then add a buffer for cancellations.", example: "Costs 80,000 and income target 300,000 means 380,000 needed. With an average job of 90,000 that is about 5 jobs. Adding one extra paid add-on per job (for example 15,000 for more edited photos) on 5 jobs adds 75,000 without finding a single new client." },
    plan30: ["Week 1: Finish setup, publish your 3 packages and best 12 portfolio pieces, send the 20-message launch and book your first job.", "Week 2: Require deposits. Contact 5 planners, venues or vendors about referrals.", "Week 3: Run a mini-session day or special offer. Ask for testimonials from past clients.", "Week 4: Add add-ons to every package, raise prices for peak dates and set next month's booking target."],
    extra: {
      open: [{ title: "Lead with your best work", how: "Your first screen should show your strongest pieces and a clear way to book. Clients decide on the look of your work before anything else." }],
      stock: [{ title: "Build a package ladder", how: "Offer three levels: a simple starter, a main package most clients choose and a premium with extras. Name them by what the client gets, not by size." }],
      paid: [{ title: "Split payments into stages", how: "A common structure is 50% to book the date and 50% before delivery, or 30/40/30 for larger jobs. Clear stages protect both sides and keep cash coming in." }],
      first: [{ title: "Do one portfolio job on purpose", how: "If you have no work to show, do one discounted or free job for a client whose results you can publish, and treat it as seriously as a paid one." }],
      market: [{ title: "Show the whole story", how: "Post the process, the moment and the result: preparation, the day itself and the finished work. Clients see the care you put in, not just the final image." }],
    },
  },
  property: {
    scripts: [
      { label: "First reply and qualify", text: "Hello [name], thanks for your interest in [property]. So I can help properly: what's your budget, when do you need to move, and what matters most (location, size, price)? Full details and photos: {link}" },
      { label: "Follow-up after a viewing", text: "Hi [name], thank you for viewing [property] today. What did you think? I can answer any question or show similar options. Details again: {link}" },
      { label: "When they push on price", text: "I understand. The price reflects [location, size, condition, what's included]. I can speak to the owner about [reasonable flexibility, e.g. payment terms]. Which part matters most to you?" },
      { label: "Pitch a landlord or owner", text: "Hello [name], I help owners in [area] find reliable [tenants/buyers] quickly, with proper viewings and paperwork. Would you like me to list your property and send you my terms? See my listings: {link}" },
      { label: "Ask for a testimonial", text: "Hi [name], congratulations on [your new home/your sale]! If you're happy with how I handled it, would you share two or three lines about the experience? It helps other clients trust me." },
    ],
    mistakes: ["Listing properties without accurate details. Wrong sizes or hidden fees damage your name quickly.", "Slow replies. Serious buyers and renters contact several agents at once.", "Skipping qualification. Showing places to people who can't afford them wastes your days.", "No written agreements. Agree fees and terms in writing and follow your local rules.", "Taking more listings than you can manage. Quality of service beats quantity of listings.", "Pushing without listening. Match properties to real needs and people send their friends."],
    breakeven: { title: "Work backwards from closed deals", how: "Needed revenue = monthly costs + the income you want. Divide by your average commission or fee per closed deal to see how many deals you need. Then divide by your viewing-to-deal rate to see how many viewings that takes.", example: "Costs 120,000 and income target 300,000 means 420,000. With an average fee of 150,000 per deal you need about 3 deals. If about 1 in 10 viewings becomes a deal (yours may differ), that is roughly 30 viewings, so batching them saves a lot of time." },
    plan30: ["Week 1: Finish setup and Verification, list your best 3 to 5 properties fully, and reply to every enquiry within the hour.", "Week 2: Qualify every enquirer. Batch viewings on set days and follow up the same day.", "Week 3: Pitch 5 landlords or owners. Start a want-list for your enquirers and match new listings to it.", "Week 4: Review which listings got the most enquiries, update or remove old ones, request testimonials and set next month's goals."],
    extra: {
      open: [{ title: "Verification matters most here", how: "Property deals involve big money and big trust. A verified, clearly presented business with real contact details is far more likely to be taken seriously." }],
      stock: [{ title: "Use a listing checklist", how: "For every property record price, location, size, rooms, condition, extra costs, who it suits and the next step. Complete listings attract fewer time-wasters." }],
      paid: [{ title: "Take fees under a written agreement", how: "Agree your fee, who pays it and when in writing before you act, and follow local rules for agents. Send formal invoices for what is agreed." }],
      first: [{ title: "Tell your network what you list", how: "Property moves by word of mouth. Tell everyone in your circle what you are listing and in which areas, and ask them to pass it on." }],
      market: [{ title: "Short video walk-throughs", how: "A 60-second walk-through of the property, shot steady in daylight, answers questions that photos can't. End with the price and one way to enquire." }],
    },
  },
  community: {
    scripts: [
      { label: "Personal invitation", text: "Hi [name], we're gathering on [date] at [place] for [event]. I'd love to see you there. Details and registration: {link}. Can you bring someone with you?" },
      { label: "Follow up a first-timer", text: "Hi [name], it was so good to meet you on [day]! Thank you for coming. We'd love to see you again: our next gathering is [date]. Details: {link}" },
      { label: "Project giving appeal", text: "We are raising [amount] for [specific project] by [date]. So far we have reached [amount]. You can give any amount here: {link}. Thank you for being part of this." },
      { label: "Thank-you and report", text: "Thank you for your support! Because of you, we [specific result, e.g. completed the roof / fed 200 families]. Here is what's next: {link}" },
      { label: "Ask for a volunteer", text: "Hi [name], we need help with [specific task] on [date], about [time needed]. Would you be able to help? It would mean a lot to the team." },
    ],
    mistakes: ["Vague appeals. People give to specific goals with a target and a deadline.", "No follow-up of first-time visitors. Most people who don't hear from you within days don't return.", "No reporting. If people can't see what their gift achieved, they give less next time.", "Depending on one big event. Build a regular rhythm of smaller gatherings and updates.", "Making giving or registration hard. Every extra step loses people.", "Leaving volunteers unthanked. Public thanks keep people involved."],
    breakeven: { title: "Plan giving with a gift ladder", how: "For a project goal, plan a few gift levels and estimate how many people you need at each, instead of hoping for a total. It makes the target feel achievable and tells you who to ask.", example: "Goal 2,000,000. Plan about 40 people giving 20,000 (800,000), 15 giving 50,000 (750,000) and 5 giving 100,000 (500,000). That totals 2,050,000, so you know you need roughly 60 givers across three levels." },
    plan30: ["Week 1: Finish setup, publish your next event and one clear project with a goal, and send personal invitations.", "Week 2: Welcome and follow up every first-timer within 48 hours. Share a short progress update.", "Week 3: Ask your core members to bring two people each. Recognise your volunteers publicly.", "Week 4: Share a report of what was achieved, announce next month's plan and set a growth target."],
    extra: {
      open: [{ title: "Tell your story clearly", how: "Share who you are, what you believe and what you are working on, with real photos. People join and give when they understand the mission." }],
      stock: [{ title: "One page, one action", how: "Each event or giving page should have a single clear action: register, give or volunteer. Fewer choices means more people complete it." }],
      paid: [{ title: "Be transparent about how funds are used", how: "State what contributions pay for and report back regularly. Transparency is the foundation of lasting trust." }],
      first: [{ title: "Start with the people already close to you", how: "Ask your most committed members to invite one person each to the next gathering. A familiar face makes a first visit easy." }],
      market: [{ title: "Share real moments", how: "Post short stories and photos of real people and events (with permission). People respond to people." }],
    },
  },
  general: {
    scripts: [
      { label: "Follow-up (no reply after 2 days)", text: "Hi [name], just checking you saw my message. [Offer] is available until [date]. Here is the link: {link}" },
      { label: "When they say it's too expensive", text: "Thanks for being honest. The price includes [what they get]. If you need a smaller option, [cheaper option] is [price]: {link}" },
      { label: "Ask for a review", text: "Hi [name], thank you for your order! If you're happy, a quick review or photo would help me a lot. Thank you!" },
      { label: "Win back a customer", text: "Hi [name], it's been a while! Here's what's new: [offer or product]. Use [code] for [perk]: {link}" },
      { label: "Ask for a referral", text: "I'm glad you liked it! If you send a friend to {link}, you both get [reward]." },
    ],
    mistakes: ["Trying to sell everything at once. Lead with one clear offer.", "Pricing without knowing costs. Know what each sale earns you.", "Slow replies. Fast answers win sales.", "No proof. Reviews and photos are what make strangers trust you.", "Posting and disappearing. Consistency beats bursts.", "Not following up. Many sales come on the second or third contact."],
    breakeven: { title: "Know your break-even", how: "Break-even sales = monthly fixed costs ÷ profit per sale. Work it out once and you know what a good month looks like.", example: "Costs 100,000 a month. Profit per sale 5,000. 100,000 ÷ 5,000 = 20 sales a month, a bit under one a day, to cover costs. Sales after that are profit." },
    plan30: ["Week 1: Finish setup, list your best offers, send the 20-message launch and aim for your first sale.", "Week 2: Aim for 10 sales. Create a launch coupon and post daily.", "Week 3: Collect 5 reviews, add a bundle or package and start a referral offer.", "Week 4: Check Analytics, drop what doesn't sell, back what does and set next month's goal."],
    extra: {
      open: [{ title: "Make your first screen count", how: "Your logo, headline, best product and a clear way to order should all show before anyone scrolls." }],
      stock: [{ title: "Show what's included", how: "For each offer, state exactly what the customer gets, how long it takes and what it costs. Clarity sells more than clever descriptions." }],
      paid: [{ title: "Make paying effortless", how: "Fewer steps and clear totals mean fewer abandoned orders. Test checkout on your own phone regularly." }],
      first: [{ title: "Ask directly", how: "Tell people exactly what you want them to do: order, book or share. People respond to a clear ask." }],
      market: [{ title: "Repeat your best message", how: "When a post gets orders, post a version of it again. Most of your audience hasn't seen it." }],
    },
  },
};
