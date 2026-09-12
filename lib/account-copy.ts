export type AccountCopy = { orders: string; bookings: string; wishlist: string; account: string };
const CATEGORY_COPY: Record<string, AccountCopy> = {
  Restaurant:{orders:"Orders",bookings:"Reservations",wishlist:"Saved",account:"My account"},
  "Hotel & Lodging":{orders:"Purchases",bookings:"Reservations",wishlist:"Saved stays",account:"Guest account"},
  Beauty:{orders:"Orders",bookings:"Appointments",wishlist:"Saved beauty",account:"My account"},
  Salon:{orders:"Orders",bookings:"Appointments",wishlist:"Saved services",account:"Client account"},
  Photography:{orders:"Orders",bookings:"My sessions",wishlist:"Saved",account:"Client portal"},
  "Professional Services":{orders:"Invoices",bookings:"Projects",wishlist:"Saved",account:"Client portal"},
};
const DEFAULT_COPY: AccountCopy={orders:"Orders",bookings:"Bookings",wishlist:"Wishlist",account:"My account"};
export function getAccountCopy(_templateName?:string|null,businessCategory?:string|null){return businessCategory&&CATEGORY_COPY[businessCategory]?CATEGORY_COPY[businessCategory]:DEFAULT_COPY;}
