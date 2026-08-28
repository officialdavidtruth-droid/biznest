// Route: /store/[slug]/admin/customers
import { getCustomer360 } from "@/lib/actions/customers";
import { Customer360View } from "@/components/dashboard/customer-360";

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ u?: string; e?: string; p?: string; n?: string }>;
}) {
  const { slug } = await params;
  const { u, e, p, n } = await searchParams;
  const customers = await getCustomer360(slug);
  return <Customer360View customers={customers} openHint={{ userId: u, email: e, phone: p, name: n }} />;
}
