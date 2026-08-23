import { getCustomer360 } from "@/lib/actions/customers";
import { Customer360View } from "@/components/dashboard/customer-360";

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const customers = await getCustomer360(slug);
  return <Customer360View customers={customers} />;
}
