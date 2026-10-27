import { redirect } from "next/navigation";

// Coupons / gift cards now live in the "Coupons & Gift Cards" app. Old links and
// bookmarks land on the app page, which handles the install prompt.
export default async function LegacyCouponsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/store/${slug}/admin/apps/coupons-gift-cards`);
}
