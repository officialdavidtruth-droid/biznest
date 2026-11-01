/**
 * Copy for the "Learn this page" guide. Keys are paths relative to
 * /<slug>/admin ("" = dashboard home). Longest matching prefix wins, so
 * "/apps/crm" beats "/apps". Plain data only: safe to import in client code.
 * Pages with no entry still get an automatic guide built from what is on screen.
 */
export type GuideStep = { title: string; body: string };
export type PageGuide = { title: string; intro: string; steps: GuideStep[] };

const g = (title: string, intro: string, steps: GuideStep[]): PageGuide => ({ title, intro, steps });
const s = (title: string, body: string): GuideStep => ({ title, body });

export const PAGE_GUIDES: Record<string, PageGuide> = {
  "": g("Dashboard home", "Your daily snapshot: what sold, what is waiting and what needs you.", [
    s("Read the top numbers", "The cards at the top show today's sales, orders and customers. Tap one to open the full list behind it."),
    s("Act on what is waiting", "Anything that needs attention, like new orders or unpaid invoices, is surfaced here so nothing slips."),
    s("Jump anywhere", "Use the menu (or the bottom tabs on your phone) to open Orders, Products, Customers and the rest."),
  ]),
  "/orders": g("Orders", "Every order from your store lands here.", [
    s("Find an order", "Use search and the status filter to narrow the list. Newest orders are at the top."),
    s("Open an order", "Tap an order to see the items, the customer's details and the delivery address."),
    s("Move it along", "Change the status as you go (for example Processing, then Shipped, then Delivered). The customer is updated automatically."),
    s("Handle problems", "Refunds and disputes are handled from inside the order, so the history stays in one place."),
  ]),
  "/products": g("Products", "Everything you sell, with photos, prices and stock.", [
    s("Add a product", "Tap Add product, then fill in the name, price, photos and description. Good photos sell more."),
    s("Set stock and options", "Add stock quantity and, if needed, variants like size or colour. Customers pick them on your store."),
    s("Publish or hide", "A product only appears on your store when it is published. Unpublish to hide it without deleting it."),
    s("Edit in bulk", "Use the list to update prices or stock quickly, or import many products at once with a CSV."),
  ]),
  "/services": g("Services", "What customers can book from you.", [
    s("Add a service", "Give it a name, price and how long it takes."),
    s("Set availability", "Choose when you are open so customers only see times you can actually do."),
    s("Publish", "Published services show up on your store with a Book button."),
  ]),
  "/bookings": g("Bookings", "Reservations and appointments customers make online.", [
    s("Review new bookings", "New bookings appear at the top. Check the date, time and customer details."),
    s("Confirm or reschedule", "Change the status to confirm, complete or cancel. The customer is notified."),
    s("See the calendar", "Open Calendar for the same bookings laid out by day and week."),
  ]),
  "/calendar": g("Calendar", "Your bookings by day and week.", [
    s("Switch the view", "Move between day, week and month to plan your time."),
    s("Tap a booking", "Open any booking on the calendar to see or change its details."),
  ]),
  "/inventory": g("Inventory", "Stock levels, cost and profit.", [
    s("Spot low stock", "Items running low are highlighted so you can reorder in time."),
    s("Update quantities", "Edit stock right in the table after you receive or count items."),
    s("Check your profit", "Add the cost of each item and the summary shows your margin."),
  ]),
  "/customers": g("Customers", "Everyone who has bought from or booked with you.", [
    s("Search a customer", "Find someone by name, phone or email."),
    s("Open their history", "See their orders, bookings and spending in one place."),
    s("Follow up", "Use this list to thank repeat buyers or reach out to people who have gone quiet."),
  ]),
  "/suppliers": g("Suppliers", "Keep your suppliers' details together.", [
    s("Add a supplier", "Save their name, phone and what they supply."),
    s("Use them in purchase orders", "Suppliers you save here can be picked when you order stock."),
  ]),
  "/purchase-orders": g("Purchase orders", "Order stock from your suppliers and track it.", [
    s("Create an order", "Pick the supplier, add the items and quantities."),
    s("Receive stock", "When goods arrive, mark the order received and your stock updates."),
  ]),
  "/delivery": g("Delivery", "Where you deliver and what it costs.", [
    s("Add a delivery zone", "Name an area and set the price to deliver there."),
    s("Keep it accurate", "Customers see these prices at checkout, so update them when your costs change."),
  ]),
  "/staff": g("Staff", "Invite your team and control what they can do.", [
    s("Invite someone", "Add their email and a position, such as Cashier."),
    s("Choose permissions", "Tick only the areas each person needs. Owners-only areas stay private."),
    s("Remove access", "You can turn off a team member's access at any time."),
  ]),
  "/payments": g("Payments", "Money you have received and how you get paid out.", [
    s("See your payments", "Each customer payment is listed with its status."),
    s("Connect payouts", "Add your bank details so earnings settle straight to your account."),
  ]),
  "/invoices": g("Invoices", "Bill customers and see who has paid.", [
    s("Create an invoice", "Pick a customer, add line items and send it."),
    s("Track payment", "Paid, unpaid and overdue invoices are shown clearly. Use the actions on a row to send a reminder."),
  ]),
  "/quotes": g("Quotes", "Quote requests from your website.", [
    s("Read the brief", "Open a request to see exactly what the customer wants."),
    s("Reply with a price", "Send a quote back, then turn it into an invoice when they accept."),
  ]),
  "/apps/coupons-gift-cards": g("Coupons & Gift Cards", "Discount codes and stored-value cards for your customers.", [
    s("Create a code", "Set the code, the discount and when it expires."),
    s("Share it", "Give the code to customers. You can pause or delete it any time."),
    s("Issue a card", "Enter an amount (and a recipient email if it is a gift). You get a code to hand over."),
    s("Take it in store", "When a customer pays with a card, enter the code and amount to deduct it."),
  ]),
  "/referrals": g("Referrals", "Reward customers who bring friends.", [
    s("Set the rewards", "Choose how many points the referrer and the new customer each get."),
    s("Switch it on", "Customers then see a personal link in their account. Rewards are paid on the friend's first completed order."),
  ]),
  "/abandoned-checkouts": g("Abandoned checkouts", "Shoppers who left before paying.", [
    s("Review them", "See who left and what was in their cart."),
    s("Follow up", "Send a reminder or a small discount to win the sale back."),
  ]),
  "/reviews": g("Reviews", "What customers say about you.", [
    s("Read new reviews", "Good reviews build trust; read the critical ones too."),
    s("Respond", "A polite reply shows other customers you care."),
  ]),
  "/messages": g("Messages", "Conversations with customers.", [
    s("Open a conversation", "Tap a customer to read the thread."),
    s("Reply quickly", "Fast replies lead to more sales. You are notified when a new message arrives."),
  ]),
  "/analytics": g("Analytics", "Reports on what is working.", [
    s("Pick a date range", "Change the period to compare this week with last."),
    s("Read the charts", "Sales, orders and customers over time. Rising lines are good, dips deserve a look."),
  ]),
  "/templates": g("Templates", "The design of your online store.", [
    s("Preview a design", "Open a template to see how your store would look."),
    s("Switch any time", "Your products and content stay; only the look changes."),
  ]),
  "/customize": g("Customize website", "Edit your website visually.", [
    s("Change the hero", "Update the big headline and image visitors see first."),
    s("Edit sections", "Rewrite your story, change colours, add or reorder blocks."),
    s("Save and view", "Save, then open your store to check how it looks."),
  ]),
  "/settings": g("Settings", "Your business details and store options.", [
    s("Business details", "Name, logo, phone and address shown to customers."),
    s("Store options", "Turn features on or off to suit how you sell."),
    s("Save changes", "Remember to save after editing."),
  ]),
  "/verification": g("Verification", "Prove your business is real so customers trust you.", [
    s("Check your status", "See which steps are done and which are still needed."),
    s("Finish the steps", "Upload the documents asked for. A person reviews them."),
  ]),
  "/subscription": g("Subscription", "Your plan and billing.", [
    s("See your plan", "What you have now and what it includes."),
    s("Upgrade", "Move to a higher plan to unlock more apps and features."),
  ]),
  "/activity": g("Activity", "A record of who did what.", [
    s("Review changes", "Every important action by you or your team is logged with who and when."),
  ]),
  "/support": g("Support", "Get help from the BizNest team.", [
    s("Send a message", "Describe the problem and attach a screenshot if you can."),
  ]),
  "/pos": g("Point of sale", "Ring up in-person sales.", [
    s("Add items", "Tap products to add them to the sale."),
    s("Take payment", "Choose how the customer pays and complete the sale."),
    s("It joins your records", "In-person sales appear next to online orders in your reports."),
  ]),

  // ---- Apps (plugins) ----
  "/apps": g("Apps", "Extra tools you can add to your business.", [
    s("Browse apps", "Each card is a tool, such as CRM, HR & Payroll or Procurement. Only apps that fit your business and plan can be installed."),
    s("Install one", "Tap Install (or Upgrade if your plan needs it). The app is added to your menu straight away."),
    s("Open an installed app", "Open it from here or from the Apps section of your menu. Each app has its own Learn this page guide."),
  ]),
  "/apps/crm": g("CRM & Sales", "Keep track of leads and turn them into customers.", [
    s("Add a lead", "Save someone who is interested, with their contact details and where they came from."),
    s("Move them along", "Drag or change a lead's stage as the conversation progresses, from new to won."),
    s("Open a lead", "Tap a lead to see notes, history and next steps, and log each call or message."),
    s("Review the pipeline", "The tabs show your whole pipeline so you can see where deals are stuck."),
  ]),
  "/apps/financial-control": g("Financial Control", "Keep your money organised and approved.", [
    s("See the overview", "Income, spending and balances at a glance."),
    s("Record and approve", "Log expenses and approve or reject requests so spending stays in check."),
    s("Check reports", "Use the reports to see where money goes each month."),
  ]),
  "/apps/hr-payroll": g("HR & Payroll", "Manage your team and pay them.", [
    s("Add employees", "Create a record for each person with their role and pay."),
    s("Run payroll", "Pick the period, review the amounts and approve the run."),
    s("Keep records", "Payslips and history are kept for each employee."),
  ]),
  "/apps/procurement": g("Procurement & Vendors", "Buy from vendors in an organised way.", [
    s("Add vendors", "Save the companies you buy from."),
    s("Raise purchase requests", "Create an order with items and prices, then send it for approval."),
    s("Track delivery", "Mark orders received so records stay accurate."),
  ]),
  "/apps/requisition": g("Requisitions", "Staff request items; managers approve.", [
    s("Make a request", "Describe what you need and why."),
    s("Approve or decline", "Managers review each request and respond."),
    s("Follow status", "Every request shows whether it is pending, approved or done."),
  ]),
  "/apps/seo": g("SEO", "Help customers find your store on Google.", [
    s("Fill in titles and descriptions", "These are what people see in search results."),
    s("Check the score", "Fix the items flagged to improve your ranking."),
  ]),
  "/apps/fnb-operations": g("FnB Operations", "Run your restaurant service.", [
    s("Set up your menu", "Add dishes with prices so they can be ordered."),
    s("Run service", "Orders go to the kitchen screen and move through preparing to ready."),
    s("Review the day", "See what sold and how fast the kitchen worked."),
  ]),
  "/apps/pms": g("BizNest PMS", "Property management for hotels and lodging.", [
    s("Set up rooms", "Add your room types, rates and numbers."),
    s("Handle reservations", "Create and manage bookings, check guests in and out."),
    s("Housekeeping and billing", "Track room cleaning and add charges to a guest's bill."),
  ]),
  "/pms": g("BizNest PMS", "Property management for hotels and lodging.", [
    s("Set up rooms", "Add your room types, rates and numbers."),
    s("Handle reservations", "Create and manage bookings, check guests in and out."),
    s("Housekeeping and billing", "Track room cleaning and add charges to a guest's bill."),
  ]),
  "/apps/travel-agency": g("BizNest Travel", "Run your travel agency.", [
    s("Add clients and suppliers", "Save passport details and the airlines, hotels and operators you book through."),
    s("Build a trip file", "Create a trip, add services with cost and selling price, and move it from enquiry to ticketed."),
    s("Collect payments", "Record deposits and schedule instalments so you always know who owes what."),
  ]),
  "/travel": g("BizNest Travel", "Run your travel agency.", [
    s("Add clients and suppliers", "Save passport details and the airlines, hotels and operators you book through."),
    s("Build a trip file", "Create a trip, add services with cost and selling price, and move it from enquiry to ticketed."),
    s("Collect payments", "Record deposits and schedule instalments so you always know who owes what."),
  ]),
  "/fnb": g("FnB", "Restaurant tools for kitchen and service.", [
    s("Manage the menu", "Add or hide dishes and set prices."),
    s("Watch live orders", "Orders move from new to preparing to ready."),
  ]),
  "/kitchen": g("Kitchen screen", "Orders for the kitchen team.", [
    s("See what to cook", "New orders appear here as they come in."),
    s("Mark progress", "Tap an order when it is being made and again when ready."),
  ]),
};

/** Fallback copy for installed apps that have no dedicated entry above. */
export const GENERIC_APP_GUIDE: PageGuide = g("This app", "An extra tool installed on your business.", [
  s("Start from the overview", "The first screen summarises this app. Look at the tabs or menu to find its sections."),
  s("Add your first record", "Most apps begin empty. Use the Add or New button to create your first entry."),
  s("Come back to Apps", "Use the Apps back bar at the top to return to your apps list."),
]);

/** Pick the guide for a path relative to /<slug>/admin (longest prefix wins). */
export function findGuide(rel: string): PageGuide | null {
  const path = rel.replace(/\/+$/, "");
  if (path in PAGE_GUIDES) return PAGE_GUIDES[path];
  const keys = Object.keys(PAGE_GUIDES).filter((k) => k && path.startsWith(k + "/")).sort((a, b) => b.length - a.length);
  if (keys.length) return PAGE_GUIDES[keys[0]];
  if (path.startsWith("/apps/")) return GENERIC_APP_GUIDE;
  return null;
}
