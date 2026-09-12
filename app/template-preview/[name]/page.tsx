import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GRANDEUR_TEMPLATE_NAME } from "@/lib/template-themes";
import { GrandeurHome } from "@/components/storefront/grandeur-restaurant";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "BizNest Template Preview",
  robots: { index: false, follow: false },
};

const PREVIEW_SLUG = "__biznest-template-preview";

const ITEMS = [
  ["breakfast", "Classic Pancakes", 6000, "Breakfast"],
  ["appetizer", "Spring Rolls", 5000, "Appetizers"],
  ["main", "Grilled Lagos Pepper Chicken", 12000, "Main Course"],
  ["seafood", "Grilled Prawns", 15000, "Seafood"],
  ["grill", "Grilled Ribeye Steak", 18000, "Grills"],
  ["pasta", "Truffle Pasta", 12000, "Pasta"],
  ["salad", "Caesar Salad", 8500, "Salads"],
  ["dessert", "Chocolate Lava Cake", 7500, "Desserts"],
  ["drink", "Signature Mocktail", 4500, "Drinks"],
].map(([id, name, price, category], index) => ({
  id: `${id}-${index}`,
  kind: "product" as const,
  name: String(name),
  description: "Signature dish prepared with premium ingredients.",
  price: Number(price),
  currency: "NGN",
  image: null,
  categoryName: String(category),
  type: "PRODUCT",
  rentalUnit: null,
  isBookable: false,
}));

const STORE = {
  name: "The Grandeur Restaurant",
  slug: PREVIEW_SLUG,
  logoUrl: null,
  bannerUrl: null,
  contactEmail: "hello@thegrandeurrestaurant.com",
  contactPhone: "+234 803 123 4567",
  email: "hello@thegrandeurrestaurant.com",
  phone: "+234 803 123 4567",
  address: "123 Luxury Avenue, Abuja, Nigeria",
  sellsProducts: true,
  storyImage: null,
  heroOverrides: null,
  storyOverrides: null,
  socialLinks: {},
  business: { description: "Fine dining. Greater moments.", verificationBadge: true },
};

export function generateStaticParams() {
  return [{ name: GRANDEUR_TEMPLATE_NAME }];
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  if (name !== GRANDEUR_TEMPLATE_NAME) notFound();
  return <GrandeurHome store={STORE as any} slug={PREVIEW_SLUG} items={ITEMS} reviews={[]} />;
}
