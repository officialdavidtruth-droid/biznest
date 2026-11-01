-- ensureSystemPlugins never overwrites existing Plugin rows (SupaAdmin is authoritative),
-- so run this once against the live database to match lib/plugins.ts.
UPDATE "Plugin" SET "description" = 'A support inbox over customer conversations: see what needs a reply, what has waited over 24 hours, and your median first-response time.' WHERE "key" = 'helpdesk';
UPDATE "Plugin" SET "description" = 'Keep an asset register for equipment, vehicles and property, with purchase cost, depreciation you post by period, maintenance notes and disposal.' WHERE "key" = 'asset-management';
UPDATE "Plugin" SET "description" = 'Store contracts and statutory documents with expiry dates and notes, and see what is expiring or expired alongside pending approvals.' WHERE "key" = 'legal-compliance';
UPDATE "Plugin" SET "description" = 'See customer points balances and the points earned and redeemed over the last 30 days.' WHERE "key" = 'loyalty-rewards';
UPDATE "Plugin" SET "description" = 'Vehicle, driver, fuel and servicing tracking for logistics and construction businesses.', "isComingSoon" = true WHERE "key" = 'fleet-management';
