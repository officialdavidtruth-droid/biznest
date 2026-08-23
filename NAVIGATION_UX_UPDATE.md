# BizNest Dashboard Navigation UX Update

The dashboard navigation has been consolidated around how a small business owner actually works instead of exposing every feature as a separate top-level module.

## New groups

- **Sell:** Products, Services, Orders, Point of Sale, plus category-specific selling tools such as Bookings.
- **Manage:** Inventory, Customers, Suppliers, Purchase Orders, Delivery Zones, Staff.
- **Money:** Payments, Invoices, Quotes.
- **Grow:** Marketing, Coupons, Abandoned Checkouts, Reviews, Messages, Analytics & Profit.
- **Website:** Templates, AI Store Builder, Website Builder.
- **Account:** Settings, Verification, Subscription, Activity Log, Support.

### Deliberate UX choices

- Customers live under **Manage**, because the customer record is an operational system rather than just a marketing feature.
- Profit remains part of **Analytics & Profit** until BizNest has a dedicated expense/profit ledger; this avoids creating a dead or misleading navigation destination.
- The old separate **Website Editor (beta)** link was removed from primary navigation because the existing Customize Website flow already contains the website editing/content functionality. The old route remains intact for existing bookmarks.
- Existing route permissions and server-side access checks continue to use the same single navigation source of truth.
- Desktop sidebar and mobile drawer/bottom navigation continue to derive from the same `buildNavGroups()` configuration.
