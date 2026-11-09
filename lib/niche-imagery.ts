import { defaultPhoto } from "@/lib/default-images";

/**
 * Curated stock photography per business type. A store that has not uploaded its own banner or product
 * photos would otherwise render flat colour blocks, which reads as unfinished. Every id below was checked to load.
 * First id = hero; the rest feed sample products / galleries in template previews.
 */
const P = (id: string) => `photo-${id}`;
const SETS: Record<string, string[]> = {
  Beauty: ["1522335789203-aabd1fc54bc9", "1596462502278-27bfdc403348", "1560066984-138dadb4c035", "1562322140-8baeececf3df"],
  Salon: ["1560066984-138dadb4c035", "1562322140-8baeececf3df", "1521590832167-7bcbfaa6381f", "1522335789203-aabd1fc54bc9"],
  Photography: ["1452587925148-ce544e77e70d", "1554048612-b6a482bc67e5", "1519167758481-83f550bb49b3", "1511795409834-ef04bbd61622"],
  Agency: ["1522071820081-009f0129c71c", "1497366216548-37526070297c", "1454165804606-c3d57bc86b40", "1461749280684-dccba630e2f6"],
  "Professional Services": ["1454165804606-c3d57bc86b40", "1507679799987-c73779587ccf", "1497366216548-37526070297c", "1522071820081-009f0129c71c"],
  "Software Development": ["1461749280684-dccba630e2f6", "1498049794561-7780e7231661", "1497366216548-37526070297c", "1522071820081-009f0129c71c"],
  Cleaning: ["1581578731548-c64695cc6952", "1558317374-067fb5f30001", "1555041469-a586c61ea9bc", "1586023492125-27b2c045efd7"],
  Construction: ["1504307651254-35680f356dfd", "1541888946425-d81bb19240f5", "1560518883-ce09059eeffa", "1564013799919-ab600027ffc6"],
  Restaurant: ["1414235077428-338989a2e8c0", "1517248135467-4c7edcad34c4", "1542838132-92c53300491e", "1488459716781-31db52582fe9"],
  "Food & Groceries": ["1542838132-92c53300491e", "1488459716781-31db52582fe9", "1414235077428-338989a2e8c0", "1500382017468-9049fed747ef"],
  Agriculture: ["1500382017468-9049fed747ef", "1542838132-92c53300491e", "1488459716781-31db52582fe9", "1414235077428-338989a2e8c0"],
  Health: ["1576091160399-112ba8d25d1d", "1631217868264-e5b90bb7e133", "1534438327276-14e5300c3a48", "1571019613454-1cb2f99b2d8b"],
  "Health & Fitness": ["1534438327276-14e5300c3a48", "1571019613454-1cb2f99b2d8b", "1576091160399-112ba8d25d1d", "1631217868264-e5b90bb7e133"],
  "Event Planning": ["1511795409834-ef04bbd61622", "1519167758481-83f550bb49b3", "1452587925148-ce544e77e70d", "1554048612-b6a482bc67e5"],
  Logistics: ["1586528116311-ad8dd3c8310d", "1494412574643-ff11b0a5c1c3", "1492144534655-ae79c964c9d7", "1503376780353-7e6692767b70"],
  "HR & Recruitment": ["1521737604893-d14cc237f11d", "1573496359142-b8d87734a5a2", "1507679799987-c73779587ccf", "1522071820081-009f0129c71c"],
  "Real Estate": ["1560518883-ce09059eeffa", "1564013799919-ab600027ffc6", "1555041469-a586c61ea9bc", "1586023492125-27b2c045efd7"],
  "Travel & Tourism": ["1488646953014-85cb44e25828", "1507525428034-b723cf961d3e", "1511795409834-ef04bbd61622", "1519167758481-83f550bb49b3"],
  Automotive: ["1492144534655-ae79c964c9d7", "1503376780353-7e6692767b70", "1494412574643-ff11b0a5c1c3", "1586528116311-ad8dd3c8310d"],
  "Home & Furniture": ["1555041469-a586c61ea9bc", "1586023492125-27b2c045efd7", "1560518883-ce09059eeffa", "1564013799919-ab600027ffc6"],
  Electronics: ["1498049794561-7780e7231661", "1550009158-9ebf69173e03", "1461749280684-dccba630e2f6", "1497366216548-37526070297c"],
  Fashion: ["1441986300917-64674bd600d8", "1445205170230-053b83016050", "1521590832167-7bcbfaa6381f", "1522335789203-aabd1fc54bc9"],
  Retail: ["1441986300917-64674bd600d8", "1445205170230-053b83016050", "1498049794561-7780e7231661", "1555041469-a586c61ea9bc"],
  Church: ["1438232992991-995b7058bbb3", "1511795409834-ef04bbd61622", "1519167758481-83f550bb49b3", "1521737604893-d14cc237f11d"],
};

function set(category?: string | null): string[] | null {
  const key = String(category ?? "").trim();
  return SETS[key] ?? null;
}

/** Wide hero photo for a business type, or null when we have no curated set (the caller keeps its own look). */
export function nicheHeroPhoto(category?: string | null, width = 1800): string | null {
  const s = set(category);
  return s ? defaultPhoto(P(s[0]), width) : null;
}

/** Photo number `i` (cycles) for sample products or galleries of a business type. */
export function nicheSamplePhoto(category: string | null | undefined, i: number, width = 900): string | null {
  const s = set(category);
  return s ? defaultPhoto(P(s[i % s.length]), width) : null;
}
