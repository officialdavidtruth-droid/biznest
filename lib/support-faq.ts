/**
 * Rule-based support assistant. No AI, no API key, no network: every answer
 * below is written by us, and questions are matched to answers by keywords.
 *
 *  - FAQ: hand-written answers for common questions (highest priority).
 *  - Every entry in PAGE_GUIDES is also turned into an answer automatically,
 *    so each dashboard page is covered and the two never disagree.
 *  - Anything that needs a person is flagged `handoff` and shows the
 *    "Send this to the BizNest team" email button.
 *
 * To teach the assistant something new, add an entry to FAQ (or a keyword to
 * an existing one). Plain data + pure functions: safe to import in client code.
 */
import { PAGE_GUIDES, findGuide, type PageGuide } from "@/lib/page-guides";

export type Faq = {
  id: string;
  /** Shown as the suggestion chip / "related" button text. */
  question: string;
  /** Words or phrases people might use. Phrases match when all their words appear (any order). */
  keywords: string[];
  answer: string;
  /** Show the "email the team" button under this answer. */
  handoff?: boolean;
  /** ids of follow-up topics offered as buttons. */
  related?: string[];
};

export type BotReply = { reply: string; handoff?: boolean; chips?: string[] };

/* -------------------------------------------------------------------------- */
/*  Hand-written answers                                                      */
/* -------------------------------------------------------------------------- */

export const FAQ: Faq[] = [
  // ---- Getting started -----------------------------------------------------
  {
    id: "first-steps",
    question: "How do I get my store ready to sell?",
    keywords: ["get started", "getting started", "set up store", "setup", "new here", "first steps", "launch store", "go live", "start selling", "begin"],
    answer:
      "Here is a simple order to follow:\n1. Settings: add your business name, logo, phone and address.\n2. Products (or Services): add what you sell, with photos and prices.\n3. Delivery: add the areas you deliver to and the price for each.\n4. Payments: add your bank details so you can be paid out.\n5. Templates / Customize website: pick a design and edit your text and images.\n6. Verification: finish the steps so customers trust your store.\n\nThen open your store and place a test order.",
    related: ["add-product", "get-paid", "customize-site", "verification"],
  },
  {
    id: "add-product",
    question: "How do I add my first product?",
    keywords: ["add product", "new product", "create product", "first product", "upload product", "list item", "sell item", "add item"],
    answer:
      "1. Open Products from the menu and tap Add product.\n2. Fill in the name, price, photos and a short description. Clear photos sell more.\n3. Set the stock quantity (and variants like size or colour if you need them).\n4. Make sure the product is published, then save.\n\nA product only shows on your store when it is published.",
    related: ["hide-product", "import-products", "stock-variants"],
  },
  {
    id: "hide-product",
    question: "How do I hide a product without deleting it?",
    keywords: ["hide product", "unpublish", "publish product", "remove product", "delete product", "product not showing", "product missing", "not showing on store", "product not visible", "disappear"],
    answer:
      "Open Products, tap the product and switch it to unpublished. It disappears from your store but stays in your list, so you can publish it again any time.\n\nIf a product is published but still not showing, check that it has a price and is in stock, then refresh your store page.",
    related: ["add-product"],
  },
  {
    id: "import-products",
    question: "Can I add many products at once?",
    keywords: ["import", "csv", "bulk", "many products", "upload many", "spreadsheet", "excel", "bulk edit", "bulk upload"],
    answer:
      "Yes. In Products, use the import option to upload a CSV file with all your products in one go. You can also edit prices and stock quickly right in the products list.",
    related: ["add-product", "stock-variants"],
  },
  {
    id: "stock-variants",
    question: "How do I manage stock, sizes and colours?",
    keywords: ["stock", "quantity", "variant", "variants", "size", "colour", "color", "out of stock", "low stock", "restock", "inventory count", "options"],
    answer:
      "Stock: set the quantity when you add or edit a product. Open Inventory to see everything in one table, spot low-stock items and update counts after you receive or count goods.\n\nSizes and colours: add variants to a product. Customers choose them on your store.",
    related: ["add-product", "purchase-orders"],
  },
  {
    id: "categories",
    question: "How do I organise products into categories?",
    keywords: ["category", "categories", "collection", "group products", "organise", "organize", "menu section"],
    answer:
      "Open Categories in your dashboard, add a category, then pick it when you add or edit a product. Customers can then browse your store by category.",
    related: ["add-product"],
  },

  // ---- Orders --------------------------------------------------------------
  {
    id: "process-order",
    question: "How do I process an order?",
    keywords: ["order", "process order", "fulfil order", "fulfill order", "new order", "order status", "ship order", "mark shipped", "mark delivered", "update order", "order notification", "where are my orders", "find order"],
    answer:
      "1. Open Orders from the menu. Newest orders are at the top.\n2. Tap an order to see the items, the customer's details and the delivery address.\n3. Change the status as you go (for example Processing, then Shipped, then Delivered). The customer is updated automatically.\n\nUse search and the status filter to find a particular order.",
    related: ["refund", "delivery-zones"],
  },
  {
    id: "refund",
    question: "How do I refund an order?",
    keywords: ["refund", "money back", "return", "returned item", "reverse payment", "chargeback", "dispute"],
    answer:
      "Refunds and disputes are handled from inside the order, so the history stays in one place: open Orders, tap the order and look for the refund or dispute options.\n\nIf you cannot find the option, or the customer is disputing a payment with their bank, the BizNest team can help.",
    handoff: true,
    related: ["process-order"],
  },
  {
    id: "abandoned",
    question: "How do I win back customers who left without paying?",
    keywords: ["abandoned", "abandoned cart", "left cart", "unpaid cart", "recover sale", "cart reminder", "checkout left", "did not pay", "didnt pay"],
    answer:
      "Open Abandoned checkouts to see who left and what was in their cart. Send a reminder, or a small discount, to win the sale back.",
    related: ["coupons"],
  },

  // ---- Money ---------------------------------------------------------------
  {
    id: "get-paid",
    question: "How do I get paid out?",
    keywords: ["get paid", "payout", "payouts", "paid out", "receive money", "bank details", "bank account", "settlement", "settle", "withdraw", "where is my money", "earnings", "cash out"],
    answer:
      "1. Open Payments from the menu.\n2. Add your bank details under payouts, so your earnings settle straight to your account.\n3. Each customer payment is listed there with its status, so you can see what is paid and what is pending.\n\nIf a payment is marked successful but the money has not reached your bank after a couple of working days, use the button below and include the order number.",
    handoff: true,
    related: ["own-gateway", "payment-problem"],
  },
  {
    id: "payout-missing",
    question: "My payout has not arrived",
    keywords: ["payout not arrived", "payment not come", "not arrive", "not reach", "not come", "money not received", "not received money", "payout delayed", "payout missing", "not paid", "havent been paid", "have not been paid", "payment not in bank", "still pending", "pending payout"],
    answer:
      "Sorry about that. First check Payments: confirm your bank details are correct and see whether the payment shows as successful or still pending. Payouts can take a little time to settle.\n\nIf it is still missing after 2 working days, send it to the team with the order number and the date, and we will look into it.",
    handoff: true,
    related: ["get-paid"],
  },
  {
    id: "own-gateway",
    question: "Can I use my own Paystack or Flutterwave account?",
    keywords: ["own gateway", "my own paystack", "my own flutterwave", "paystack", "flutterwave", "api key", "payment keys", "secret key", "public key", "webhook", "own payment"],
    answer:
      "Yes. Open Payments and look for \"Your own payment gateway\". Add your Paystack and/or Flutterwave keys and switch it on. Customer payments are then charged with your keys and the money lands in your own gateway account.\n\nOnly the store owner can see or change these keys, and staff cannot. Subscription billing and app purchases always go through BizNest.",
    handoff: true,
    related: ["get-paid"],
  },
  {
    id: "payment-problem",
    question: "A customer's payment failed or was charged twice",
    keywords: ["payment failed", "failed payment", "charged twice", "double charge", "debited", "debited but", "payment not showing", "payment issue", "payment problem", "payment error", "card declined", "transaction failed", "paid but"],
    answer:
      "Open Payments to see the payment and its status. If the customer was debited but the order shows unpaid, wait a few minutes and refresh: payments are confirmed automatically.\n\nIf it is still wrong, send it to the team with the order number, the amount and the time of the payment so we can trace it. Never share card numbers, PINs or OTP codes with anyone.",
    handoff: true,
    related: ["refund", "get-paid"],
  },
  {
    id: "invoices",
    question: "How do I send an invoice?",
    keywords: ["invoice", "invoices", "bill customer", "send bill", "overdue", "payment reminder", "receipt"],
    answer:
      "1. Open Invoices and create a new one.\n2. Pick a customer, add the line items and send it.\n3. Paid, unpaid and overdue invoices are shown clearly. Use the actions on a row to send a reminder.",
    related: ["quotes"],
  },
  {
    id: "quotes",
    question: "How do I reply to a quote request?",
    keywords: ["quote", "quotes", "quotation", "estimate", "price request", "deposit"],
    answer:
      "Open Quotes and tap a request to read exactly what the customer wants. Send a quote back with your price, then turn it into an invoice when they accept.",
    related: ["invoices"],
  },
  {
    id: "pos",
    question: "How do I sell in person (point of sale)?",
    keywords: ["pos", "point of sale", "in person", "in store sale", "walk in", "shop counter", "cashier screen", "ring up", "offline sale"],
    answer:
      "Open Point of sale, tap products to add them to the sale, choose how the customer pays and complete it. In-person sales appear next to online orders in your reports.",
    related: ["invite-staff"],
  },

  // ---- Team ----------------------------------------------------------------
  {
    id: "invite-staff",
    question: "How do I invite my staff?",
    keywords: ["invite staff", "add staff", "add team", "new staff", "team member", "add cashier", "add employee login", "staff access", "give access", "staff login", "invite", "staff"],
    answer:
      "1. Open Staff from the menu.\n2. Add their email and a position, such as Cashier.\n3. Tick only the areas that person needs (their permissions).\n4. Send the invite. They get an email to set up their login.\n\nYou can switch off a team member's access at any time. Owner-only areas, like payment keys, stay private.",
    related: ["staff-permissions", "staff-invite-problem"],
  },
  {
    id: "staff-permissions",
    question: "What can my staff see and do?",
    keywords: ["permission", "permissions", "staff can see", "restrict staff", "limit access", "remove staff", "revoke access", "block staff", "staff cant see", "staff cannot see", "owner only"],
    answer:
      "Each staff member only sees the areas you tick for them under Staff. To change what someone can do, open Staff, tap their name and update the ticks. To stop someone completely, remove or switch off their access there.\n\nOpen Activity to see a log of who did what and when.",
    related: ["invite-staff"],
  },
  {
    id: "staff-invite-problem",
    question: "My staff did not get the invite email",
    keywords: ["invite not received", "staff did not get email", "invite email", "invite link", "invitation not working", "staff cant login", "staff cannot login", "staff login problem"],
    answer:
      "Ask them to check their spam or junk folder, and confirm the email address you typed in Staff is exactly right. If it is wrong, remove the invite and send a new one to the correct address.\n\nStill nothing after a few minutes? Send it to the team with the staff member's email address.",
    handoff: true,
    related: ["invite-staff"],
  },

  // ---- Apps & plan ---------------------------------------------------------
  {
    id: "install-app",
    question: "How do I install an app?",
    keywords: ["install app", "add app", "apps", "plugin", "plugins", "get app", "enable app", "app store", "marketplace", "remove app", "uninstall"],
    answer:
      "1. Open Apps from the menu.\n2. Browse the cards. Each one is a tool such as CRM, HR & Payroll or Procurement. Only apps that fit your business and plan can be installed.\n3. Tap Install (or Upgrade if your plan needs it). The app is added to your menu straight away.\n\nEach installed app has its own \"Learn this page\" guide.",
    related: ["upgrade-plan"],
  },
  {
    id: "upgrade-plan",
    question: "How do I upgrade my plan?",
    keywords: ["upgrade", "plan", "subscription", "pricing", "price of plan", "change plan", "downgrade", "renew", "expired", "subscribe", "premium", "unlock"],
    answer:
      "Open Subscription to see your current plan and what it includes. Tap Upgrade to move to a higher plan and unlock more apps and features.",
    related: ["billing-problem", "install-app"],
  },
  {
    id: "billing-problem",
    question: "I was charged for my plan and something is wrong",
    keywords: ["billing", "charged subscription", "wrongly charged", "cancel subscription", "cancel plan", "billing problem", "billing issue", "subscription problem", "plan not active", "paid for plan", "invoice from biznest"],
    answer:
      "Open Subscription first to see your plan and its status. For billing mistakes, double charges, a plan that did not activate after paying, or cancellations, the BizNest team needs to check your account. Use the button below and tell us the date and amount.",
    handoff: true,
    related: ["upgrade-plan"],
  },

  // ---- Store look & settings ----------------------------------------------
  {
    id: "customize-site",
    question: "How do I change how my website looks?",
    keywords: ["customize", "customise", "website", "design", "change look", "theme", "banner", "hero", "colour scheme", "color scheme", "edit website", "edit store", "change text", "change picture", "homepage", "layout", "logo on store"],
    answer:
      "Templates: open Templates, preview a design and switch to it. Your products and content stay; only the look changes.\n\nEditing: open Customize website to change the big headline and image, rewrite your story, change colours and reorder sections. Save, then open your store to check how it looks.",
    related: ["business-details", "custom-domain"],
  },
  {
    id: "business-details",
    question: "How do I change my business name, logo or phone number?",
    keywords: ["business name", "change name", "logo", "phone number", "address", "contact details", "business details", "store name", "settings", "opening hours", "social media"],
    answer:
      "Open Settings. Under Business details you can change your name, logo, phone and address, which customers see on your store. Remember to save after editing.",
    related: ["custom-domain", "customize-site"],
  },
  {
    id: "custom-domain",
    question: "Can I use my own domain name?",
    keywords: ["domain", "custom domain", "own domain", "dot com", ".com", "web address", "url", "link to store", "store link", "connect domain", "dns"],
    answer:
      "Yes, on plans that include it. Open Settings and look for the custom domain section, enter your domain and follow the steps shown to point it at your store, then use the re-check option once you have updated your DNS.\n\nIf you do not see the option, your plan does not include it yet: open Subscription to upgrade. DNS changes can take a few hours to start working.",
    handoff: true,
    related: ["upgrade-plan"],
  },
  {
    id: "verification",
    question: "How do I get my business verified?",
    keywords: ["verification", "verify", "verified", "verify business", "documents", "cac", "kyc", "badge", "trust", "verification pending", "verification rejected"],
    answer:
      "Open Verification to see which steps are done and which are still needed. Upload the documents it asks for. A person reviews them, so it can take a little time.\n\nIf your verification has been pending for a long time or was rejected and you do not understand why, use the button below.",
    handoff: true,
    related: ["get-paid"],
  },

  // ---- Delivery, services, bookings ---------------------------------------
  {
    id: "delivery-zones",
    question: "How do I set delivery areas and prices?",
    keywords: ["delivery", "delivery fee", "delivery price", "delivery zone", "shipping", "shipping fee", "dispatch", "areas we deliver", "location", "pickup", "pick up"],
    answer:
      "Open Delivery, add a zone (an area) and set the price to deliver there. Customers see these prices at checkout, so update them whenever your costs change.",
    related: ["process-order"],
  },
  {
    id: "services-bookings",
    question: "How do customers book my services?",
    keywords: ["service", "services", "booking", "bookings", "appointment", "book online", "availability", "time slots", "calendar", "reschedule", "reservation"],
    answer:
      "1. Open Services and add a service with its name, price and how long it takes.\n2. Set your availability so customers only see times you can do.\n3. Publish it. It shows on your store with a Book button.\n\nNew bookings appear in Bookings, where you can confirm, reschedule, complete or cancel (the customer is notified). Calendar shows the same bookings by day, week and month.",
    related: ["add-product"],
  },

  {
    id: "hotel-pms",
    question: "How do I manage hotel rooms and guests?",
    keywords: ["hotel", "room", "rooms", "guest", "guests", "check in", "check out", "housekeeping", "lodging", "pms", "reservation", "room rate", "room type"],
    answer:
      "Open the BizNest PMS app (install it from Apps if you do not see it).\n1. Set up rooms: add your room types, rates and numbers.\n2. Handle reservations: create and manage bookings, and check guests in and out.\n3. Housekeeping and billing: track room cleaning and add charges to a guest's bill.",
    related: ["install-app"],
  },

  // ---- Customers & marketing ----------------------------------------------
  {
    id: "coupons",
    question: "How do I create a discount code?",
    keywords: ["coupon", "coupons", "discount", "promo", "promo code", "voucher", "discount code", "sale price", "offer", "percent off"],
    answer:
      "Open Coupons & Gift Cards (under Apps). Create a code, set the discount and when it expires, then share the code with customers. You can pause or delete it at any time.",
    related: ["gift-cards", "referrals"],
  },
  {
    id: "gift-cards",
    question: "How do gift cards work?",
    keywords: ["gift card", "gift cards", "stored value", "store credit", "wallet", "gift"],
    answer:
      "In Coupons & Gift Cards, issue a card by entering an amount (and a recipient email if it is a gift). You get a code to hand over. When a customer pays with it in store, enter the code and amount to deduct it.",
    related: ["coupons"],
  },
  {
    id: "referrals",
    question: "How do referrals work?",
    keywords: ["referral", "referrals", "refer a friend", "points", "reward", "loyalty", "invite friends"],
    answer:
      "Open Referrals and choose how many points the referrer and the new customer each get, then switch it on. Customers see a personal link in their account, and rewards are paid on the friend's first completed order.",
    related: ["coupons"],
  },
  {
    id: "marketing-email",
    question: "How do I email my customers?",
    keywords: ["email customers", "email marketing", "newsletter", "campaign", "marketing", "broadcast", "promotion email", "send email", "bulk email", "sms", "automation", "automations"],
    answer:
      "Open Marketing to create and send email campaigns to your customers. Open Automations to set up messages that send by themselves, such as follow-ups. Customers can unsubscribe from marketing emails with one tap, and they are respected automatically.",
    related: ["customers", "abandoned"],
  },
  {
    id: "customers",
    question: "How do I see my customers?",
    keywords: ["customers", "customer list", "customer history", "find customer", "buyer", "repeat customer", "contact customer", "customer details"],
    answer:
      "Open Customers and search by name, phone or email. Tap a customer to see their orders, bookings and spending in one place. Use the list to thank repeat buyers or reach out to people who have gone quiet.",
    related: ["marketing-email", "messages-reviews"],
  },
  {
    id: "messages-reviews",
    question: "Where are my messages and reviews?",
    keywords: ["messages", "message", "inbox", "chat with customer", "reply customer", "reviews", "review", "rating", "ratings", "feedback", "testimonial"],
    answer:
      "Messages: open Messages and tap a customer to read and reply to the thread. You are notified when a new one arrives, and quick replies lead to more sales.\n\nReviews: open Reviews to read what customers say. A polite reply, even to a critical review, shows other customers you care.",
    related: ["customers"],
  },
  {
    id: "analytics",
    question: "How do I see how my store is doing?",
    keywords: ["analytics", "reports", "report", "sales report", "statistics", "performance", "how am i doing", "best selling", "revenue", "profit", "traffic", "visitors"],
    answer:
      "Open Analytics, pick a date range (for example this week against last) and read the charts for sales, orders and customers over time. Rising lines are good; dips deserve a look. Inventory shows your cost and margin per item once you add what each item costs you.",
    related: ["stock-variants"],
  },
  {
    id: "purchase-orders",
    question: "How do I order stock from suppliers?",
    keywords: ["supplier", "suppliers", "purchase order", "purchase orders", "reorder", "buy stock", "receive stock", "vendor"],
    answer:
      "Save your suppliers in Suppliers. Then in Purchase orders, create an order, pick the supplier and add items and quantities. When the goods arrive, mark the order received and your stock updates by itself.",
    related: ["stock-variants"],
  },

  // ---- Account & trouble ---------------------------------------------------
  {
    id: "forgot-password",
    question: "I forgot my password",
    keywords: ["forgot password", "reset password", "change password", "cant login", "cannot login", "cant log in", "cannot log in", "login problem", "sign in problem", "locked out", "password"],
    answer:
      "On the sign-in page tap \"Forgot password\", enter your email and follow the link we send you. Check your spam folder if it does not arrive within a few minutes.\n\nFor your safety, never share your password, PIN or OTP codes with anyone, including us.",
    handoff: true,
  },
  {
    id: "verify-email",
    question: "I did not receive an email from BizNest",
    keywords: ["email not received", "did not receive email", "no email", "verification email", "confirm email", "verify email", "email not coming", "emails going to spam", "resend email"],
    answer:
      "Check your spam or junk folder first, and make sure the email address on your account is spelled correctly. Emails can take a few minutes to arrive. If it still has not come, use the button below and tell us the email address you used.",
    handoff: true,
  },
  {
    id: "learn-page",
    question: "How do I learn about a page I'm on?",
    keywords: ["learn this page", "help with page", "explain page", "what does this page do", "i am confused", "im confused", "i'm lost", "lost", "guide", "tutorial", "walkthrough", "how to use"],
    answer:
      "Tap the \"Learn this page\" button at the bottom right of any dashboard page. It explains that screen step by step. You can also ask me about it by name, for example \"How do I use Orders?\".",
  },
  {
    id: "bug",
    question: "Something is broken or not working",
    keywords: ["bug", "broken", "error", "not working", "doesnt work", "does not work", "problem", "issue", "crash", "stuck", "slow", "glitch", "wrong", "fail", "failed", "cannot", "cant"],
    answer:
      "Sorry about that. A few quick things to try: refresh the page, sign out and back in, and try another browser or your phone. If it still happens, send it to the team with what you were doing and a screenshot if you can, and we will fix it.",
    handoff: true,
  },
  {
    id: "contact-human",
    question: "I want to talk to a person",
    keywords: ["human", "person", "agent", "talk to someone", "speak to someone", "contact support", "support", "email support", "call", "phone support", "whatsapp", "complain", "complaint", "speak to"],
    answer:
      "Of course. Use the button below to email the BizNest team. Your chat so far is included, so you do not have to explain everything again.",
    handoff: true,
  },
];

/* -------------------------------------------------------------------------- */
/*  Matching                                                                  */
/* -------------------------------------------------------------------------- */

const STOP = new Set(
  ("a an the i me my we our you your it its is are am was be been do does did how what where when why which who can could should would will " +
    "to of in on at for and or but with from by as this that these those there here please want need like get got just also so if then than " +
    "any some about into out up not no yes hi hello hey").split(" "),
);

// Words people use for the same thing -> one canonical word.
const SYN: Record<string, string> = {
  withdrawal: "withdraw", cashout: "withdraw", payouts: "payout",
  worker: "staff", teammate: "staff", colleague: "staff", cashier: "staff", employee: "staff",
  voucher: "coupon", promo: "coupon", discount: "coupon",
  appointment: "booking", reservation: "booking", book: "booking",
  mail: "email", emails: "email",
  item: "product", goods: "product", merchandise: "product",
  money: "payment", paid: "pay", paying: "pay",
  phone: "phone", mobile: "phone",
  lost: "lost", forgot: "forgot", forget: "forgot",
  signin: "login", "log-in": "login",
  colour: "color", customise: "customize", organise: "organize",
};

function stem(w: string): string {
  let t = SYN[w] ?? w;
  if (t.length > 4) {
    if (t.endsWith("ies")) t = t.slice(0, -3) + "y";
    else if (t.endsWith("ing")) t = t.slice(0, -3);
    else if (t.endsWith("ed")) t = t.slice(0, -2);
    else if (t.endsWith("es") && !t.endsWith("ses")) t = t.slice(0, -2);
    else if (t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  }
  return SYN[t] ?? t;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/log[\s-]?in/g, "login")
    .replace(/sign[\s-]?in/g, "login")
    .replace(/[^a-z0-9.\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

type Compiled = { faq: Faq; kw: string[][]; qTokens: string[]; weight: number };

function guideToFaq(path: string, guide: PageGuide): Faq {
  const steps = guide.steps.map((st, i) => `${i + 1}. ${st.title}: ${st.body}`).join("\n");
  const where = path ? `Open ${guide.title} from the menu.` : "This is the first screen you see after signing in.";
  const words = guide.title.toLowerCase();
  return {
    id: `page:${path || "home"}`,
    question: `How do I use ${guide.title}?`,
    keywords: [words, ...words.split(/[\s&]+/).filter((w) => w.length > 2)],
    answer: `${guide.intro}\n\n${where}\n${steps}`,
  };
}

const COMPILED: Compiled[] = [
  ...FAQ.map((faq) => ({ faq, weight: 1 })),
  ...Object.entries(PAGE_GUIDES).map(([path, guide]) => ({ faq: guideToFaq(path, guide), weight: 0.75 })),
].map(({ faq, weight }) => ({
  faq,
  weight,
  kw: faq.keywords.map(tokens).filter((k) => k.length),
  qTokens: tokens(faq.question),
}));

const BY_ID = new Map(COMPILED.map((c) => [c.faq.id, c.faq]));

function score(c: Compiled, qs: Set<string>): number {
  let s = 0;
  for (const phrase of c.kw) {
    if (phrase.every((t) => qs.has(t))) s += phrase.length > 1 ? 3 * phrase.length : 2;
  }
  // Light bonus when words of the canonical question appear.
  for (const t of c.qTokens) if (qs.has(t)) s += 0.5;
  return s * c.weight;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/** Chips shown on the first screen. */
export const SUGGESTIONS = [
  "How do I add my first product?",
  "How do I get paid out?",
  "How do I invite my staff?",
  "How do I install an app?",
  "How do I process an order?",
  "How do I change how my website looks?",
];

const GREET = /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|yo|sup|hola)\b/i;
const THANKS = /\b(thanks|thank you|thx|cheers|appreciate)\b/i;
const THIS_PAGE = /\b(this page|this screen|where am i|what is this|what does this)\b/i;

function chipsFor(ids: string[] | undefined): string[] | undefined {
  const out = (ids ?? []).map((id) => BY_ID.get(id)?.question).filter((q): q is string => Boolean(q));
  return out.length ? out.slice(0, 3) : undefined;
}

/**
 * Answer a message. `page` is the dashboard path relative to /<slug>/admin
 * (e.g. "/orders"), used for "what is this page?" questions.
 */
export function answerQuestion(text: string, page?: string): BotReply {
  const raw = text.trim();
  const toks = tokens(raw);

  if (THIS_PAGE.test(raw) && page) {
    const guide = findGuide(page === "/" ? "" : page);
    if (guide) {
      const steps = guide.steps.map((st, i) => `${i + 1}. ${st.title}: ${st.body}`).join("\n");
      return { reply: `${guide.title}: ${guide.intro}\n\n${steps}` };
    }
  }

  // Greetings / thanks only when there is nothing else in the message.
  if (toks.length === 0 || (raw.split(/\s+/).length <= 3 && GREET.test(raw))) {
    return { reply: "Hi! Ask me how to do anything in your dashboard, or tap a topic below.", chips: SUGGESTIONS.slice(0, 4) };
  }
  if (THANKS.test(raw) && raw.split(/\s+/).length <= 6) {
    return { reply: "You're welcome! Anything else I can help with?" };
  }

  const qs = new Set(toks);
  const ranked = COMPILED.map((c) => ({ c, s: score(c, qs) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s);

  const best = ranked[0];
  if (best && best.s >= 2) {
    const faq = best.c.faq;
    // Offer the entry's own follow-ups, topped up with close runner-ups.
    const ids = [...(faq.related ?? [])];
    for (const r of ranked.slice(1, 4)) if (r.s >= best.s * 0.6 && !ids.includes(r.c.faq.id)) ids.push(r.c.faq.id);
    return { reply: faq.answer, handoff: faq.handoff, chips: chipsFor(ids.filter((id) => id !== faq.id)) };
  }

  // No confident match: offer the closest topics and a way to reach a person.
  const near = ranked.slice(0, 3).map((r) => r.c.faq.question);
  return {
    reply:
      "I'm not sure I have an answer for that yet. Try asking in different words, for example \"How do I add a product?\" or \"How do I get paid out?\".\n\nIf you need help from a person, tap the button below and your chat will be included.",
    handoff: true,
    chips: near.length ? near : SUGGESTIONS.slice(0, 3),
  };
}
