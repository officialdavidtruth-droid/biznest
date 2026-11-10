import type { Audience } from "@/lib/platform-email/audience";

export type EmailTemplate = {
  id: string;
  name: string;
  category: string;
  /** One line in the picker: when to use it. */
  description: string;
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: Audience;
};

export const TEMPLATE_CATEGORIES = ["Welcome", "Open your store", "Templates", "Plugins and features", "Get paid and grow", "Greetings", "Announcements"] as const;

/**
 * Ready-made emails. {name} becomes the person's first name. Anything in [[double brackets]] is a blank
 * for you to fill in; SupaAdmin refuses to send an email that still has one.
 */
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    category: "Welcome",
    name: "Welcome to BizNest",
    description: "A friendly first email for new accounts.",
    subject: "Welcome to BizNest, {name}",
    body: `Hi {name},

Welcome to BizNest. We help Nigerian businesses sell online with their own store, accept payments and get paid straight to their bank account.

Here is the simple path: tell us about your business, get verified, pick a template and add what you sell. You can try everything free for 14 days.

If you get stuck at any point, just reply to this email and a real person will help.`,
    ctaLabel: "Set up my store",
    ctaUrl: "/onboarding/business-verification",
    audience: "NO_BUSINESS",
  },
  {
    id: "how-it-works",
    category: "Welcome",
    name: "How BizNest works in 4 steps",
    description: "Explains the whole journey for people who are still looking around.",
    subject: "Your store in 4 simple steps",
    body: `Hi {name},

Opening a store on BizNest is quicker than most people expect:

1. Tell us about your business and get verified.
2. Pick a template that fits how you want to look.
3. Add your products or services, with photos and prices.
4. Share your store link and start taking orders.

Customers pay online and your money goes to your bank account. There is no commission on your sales.

Ready when you are.`,
    ctaLabel: "Start now",
    ctaUrl: "/onboarding/business-verification",
    audience: "NO_BUSINESS",
  },
  {
    id: "open-store-gentle",
    category: "Open your store",
    name: "Reminder: open your store (gentle)",
    description: "A soft nudge for people who signed up but haven't started.",
    subject: "Your BizNest store is waiting, {name}",
    body: `Hi {name},

You joined BizNest but haven't opened your store yet. No pressure. It only takes about 10 minutes, and you can change anything later.

Most people start with the basics: their business name, a template, and their first few products. The rest can wait.

Want a hand? Reply to this email and we will walk you through it.`,
    ctaLabel: "Continue setup",
    ctaUrl: "/onboarding/business-verification",
    audience: "NO_BUSINESS",
  },
  {
    id: "open-store-help",
    category: "Open your store",
    name: "Reminder: can we help you get started?",
    description: "Asks what's stopping them. Good for week two.",
    subject: "Is something stopping you, {name}?",
    body: `Hi {name},

We noticed you haven't opened your store yet, and we'd love to know why. Is it the verification step? Not sure which template to pick? Unsure what to sell first?

Reply to this email with one line about what's holding you back and we will help you sort it out.

Your account is ready whenever you are.`,
    ctaLabel: "Pick up where I left off",
    ctaUrl: "/onboarding/business-verification",
    audience: "NO_BUSINESS",
  },
  {
    id: "business-approved",
    category: "Open your store",
    name: "Your business is approved: open your store",
    description: "For approved businesses that haven't created their store.",
    subject: "You're approved, {name}. Open your store",
    body: `Hi {name},

Good news: your business has been approved on BizNest.

The last step is to open your store. Choose a name and address, pick a template and add your first products. Your 14-day free trial starts as you set up, so there's no reason to wait.`,
    ctaLabel: "Open my store",
    ctaUrl: "/onboarding/create-store",
    audience: "BUSINESS_NO_STORE",
  },
  {
    id: "choose-template",
    category: "Templates",
    name: "Find a template that fits you",
    description: "Sends people to the live template previews.",
    subject: "See how your store could look",
    body: `Hi {name},

BizNest has ready-made templates for restaurants, fashion, salons, hotels, real estate, electronics and more. Every one is fully editable: your colours, your photos, your words.

You can open a live preview of any template and click around before you decide. And you can switch templates later without losing your products.`,
    ctaLabel: "Browse templates",
    ctaUrl: "/templates",
    audience: "ALL",
  },
  {
    id: "template-new",
    category: "Templates",
    name: "New templates just landed",
    description: "Announce new or redesigned templates. Fill in the blanks.",
    subject: "New on BizNest: [[template names]]",
    body: `Hi {name},

We have added new templates to BizNest: [[template names]].

[[One or two lines on what is different, for example the layout, who it suits, or what you can edit.]]

You can preview them live and switch your store over in a few clicks. Your products and content stay exactly as they are.`,
    ctaLabel: "See the new templates",
    ctaUrl: "/templates",
    audience: "STORE_OWNERS",
  },
  {
    id: "first-products",
    category: "Get paid and grow",
    name: "Add your first products",
    description: "For store owners who may not have filled their catalog.",
    subject: "A store with products sells. Add yours",
    body: `Hi {name},

A good catalog is the fastest way to turn visitors into customers. A few quick tips:

Use clear, bright photos taken in daylight.
Write a short description that answers the first question a buyer would ask.
Set your price and stock so customers know what they can order.

Start with five products. You can add the rest as you go.`,
    ctaLabel: "Go to my dashboard",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "get-paid",
    category: "Get paid and grow",
    name: "Connect your bank and get paid automatically",
    description: "Pushes owners to add their payout bank account.",
    subject: "Get paid straight to your bank, {name}",
    body: `Hi {name},

When a customer pays on your store, BizNest sends the money to your bank account automatically. You don't have to chase anyone or transfer anything yourself.

To switch it on, connect your bank account in Payouts. We confirm the account name for you, so you know it's right.

It takes about a minute.`,
    ctaLabel: "Open my dashboard",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "plugins",
    category: "Plugins and features",
    name: "Add apps and plugins to your store",
    description: "Introduces the App Marketplace.",
    subject: "Do more with BizNest apps",
    body: `Hi {name},

Your store can do more than sell products. In the App Marketplace inside your dashboard you can add tools for how your business actually works, for example sales and customer tracking, bookings, and industry tools for travel and hotels.

Switch on only what you need. Everything works with your existing store, and you can turn an app off at any time.`,
    ctaLabel: "Open my dashboard",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "features-roundup",
    category: "Plugins and features",
    name: "Features you may have missed",
    description: "A tour of what's already in their account.",
    subject: "5 things your BizNest store can already do",
    body: `Hi {name},

A few things many store owners haven't tried yet:

Invoices and quotations: send professional PDF invoices and let customers pay a deposit.
Loyalty and rewards: keep customers coming back with points.
Abandoned checkout reminders: win back people who left without paying.
Blog posts: write articles that bring visitors from Google.
Website builder: edit your pages by clicking on them.

All of it is already in your dashboard.`,
    ctaLabel: "Explore my dashboard",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "browse",
    category: "Plugins and features",
    name: "Be seen on BizNest Browse",
    description: "Promotes the public Browse feed.",
    subject: "Let new customers discover your store",
    body: `Hi {name},

BizNest Browse is a public feed where people discover stores, watch stories and follow the businesses they like.

When you post and keep your store profile complete, new customers can find you without you spending on ads.

Have a look at what other stores are sharing, then post your first update.`,
    ctaLabel: "Open Browse",
    ctaUrl: "/browse",
    audience: "ALL",
  },
  {
    id: "share-store",
    category: "Get paid and grow",
    name: "Share your store and get your first order",
    description: "Practical tips for getting the first sales.",
    subject: "Ready for your first order, {name}?",
    body: `Hi {name},

Your store is live. Here's how to get your first customers:

Put your store link in your WhatsApp status and Instagram bio.
Send it directly to ten people who already buy from you.
Post a photo of your best product and mention the link.

Most first orders come from people who already know you.`,
    ctaLabel: "Go to my dashboard",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "refer-and-earn",
    category: "Get paid and grow",
    name: "Refer and earn",
    description: "Promotes the vendor referral program.",
    subject: "Earn cash for every vendor you bring to BizNest",
    body: `Hi {name},

You can now earn from BizNest. Share your personal referral link, and when a vendor you refer pays for a plan, you earn a reward.

Starters plan: ₦2,000 per vendor, withdraw after 5 vendors.
Entrepreneurship plan: ₦5,000 per vendor, withdraw after 2 vendors.
Business Mogul plan: ₦10,000 per vendor, withdraw after 3 vendors.

Your link and wallet are on the Refer & earn page in your dashboard.`,
    ctaLabel: "Get my referral link",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "choose-plan",
    category: "Get paid and grow",
    name: "Choose a plan before your trial ends",
    description: "Encourage trial users to pick a plan.",
    subject: "Keep your store running, {name}",
    body: `Hi {name},

Your free trial is a chance to try everything. When it ends, pick the plan that fits your business so your store stays live and your customers can keep ordering.

All plans have zero commission on your sales. You keep what you earn.

If you aren't sure which plan fits, reply and tell us what you sell. We'll point you to the right one.`,
    ctaLabel: "See plans",
    ctaUrl: "/#pricing",
    audience: "STORE_OWNERS",
  },
  {
    id: "greeting",
    category: "Greetings",
    name: "A quick hello from the BizNest team",
    description: "A warm check-in with no sales pitch.",
    subject: "A quick hello from BizNest",
    body: `Hi {name},

Just a quick note to say thank you for being part of BizNest. We're building this for Nigerian business owners like you, and what you tell us shapes what we build next.

Is there something that would make your business easier? Reply to this email and tell us. We read every message.`,
    ctaLabel: "",
    ctaUrl: "",
    audience: "ALL",
  },
  {
    id: "new-month",
    category: "Greetings",
    name: "Happy new month",
    description: "Monthly greeting with a small push to log in.",
    subject: "Happy new month, {name}",
    body: `Hi {name},

Happy new month from all of us at BizNest. We wish you plenty of orders, happy customers and a strong month for your business.

A good way to start: check your dashboard, update your prices and stock, and share your store link once.`,
    ctaLabel: "Open my dashboard",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "festive",
    category: "Greetings",
    name: "Season's greetings",
    description: "For holidays and festive periods. Fill in the occasion.",
    subject: "[[Occasion]] greetings from BizNest",
    body: `Hi {name},

Happy [[occasion]] from the whole BizNest team. Thank you for trusting us with your business this year.

[[Optional: a tip for the busy season, such as updating stock, adding a seasonal banner or sharing your store link.]]

We wish you and your family joy and a very good season of sales.`,
    ctaLabel: "",
    ctaUrl: "",
    audience: "ALL",
  },
  {
    id: "need-help",
    category: "Greetings",
    name: "Need help? We're here",
    description: "Support check-in for quiet accounts.",
    subject: "Can we help with your store, {name}?",
    body: `Hi {name},

If anything about BizNest is confusing, slow or missing, we want to know. Setting up payments, changing your template, adding products, or anything else.

Reply to this email with your question and a real person will answer, usually within a day.`,
    ctaLabel: "",
    ctaUrl: "",
    audience: "ALL",
  },
  {
    id: "product-update",
    category: "Announcements",
    name: "New feature announcement",
    description: "Announce something new. Fill in the blanks.",
    subject: "New on BizNest: [[feature name]]",
    body: `Hi {name},

We have just added [[feature name]] to BizNest.

[[What it does, in one or two plain sentences.]]

[[Who it helps and how to switch it on.]]

Tell us what you think by replying to this email.`,
    ctaLabel: "Try it now",
    ctaUrl: "/post-login",
    audience: "STORE_OWNERS",
  },
  {
    id: "promo",
    category: "Announcements",
    name: "Special offer",
    description: "A promotion. Fill in the offer, dates and conditions.",
    subject: "[[Offer headline]]",
    body: `Hi {name},

[[Describe the offer: what people get, who it's for, and when it ends.]]

[[Any conditions, for example the plan it applies to or how to claim it.]]

This offer ends on [[date]].`,
    ctaLabel: "[[Button text]]",
    ctaUrl: "/#pricing",
    audience: "ALL",
  },
  {
    id: "maintenance",
    category: "Announcements",
    name: "Scheduled maintenance notice",
    description: "Tell people about planned downtime.",
    subject: "BizNest maintenance on [[date]]",
    body: `Hi {name},

We'll be carrying out planned maintenance on [[date]] from [[start time]] to [[end time]] (Lagos time). During this time BizNest and your store may be briefly unavailable.

Nothing you have saved will be lost. Orders and payments made before the maintenance are safe.

Thank you for your patience while we make things better.`,
    ctaLabel: "",
    ctaUrl: "",
    audience: "ALL",
  },
];

/** Does the text still contain an unfilled [[blank]]? */
export function hasPlaceholder(...texts: string[]) {
  return texts.some((t) => /\[\[[^\]]*\]\]/.test(t));
}
