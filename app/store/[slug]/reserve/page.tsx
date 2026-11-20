// Route: /store/[slug]/reserve — public table reservation (date, time, party size).
import { notFound } from "next/navigation";
import Link from "next/link";
import { getReserveInfo } from "@/lib/actions/table-reservations";
import { TableReserveForm } from "@/components/storefront/table-reserve-form";

export const metadata = { title: "Reserve a table" };

export default async function ReservePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await getReserveInfo(slug);
  if (!info) notFound();
  return (
    <main className="min-h-[70vh] bg-neutral-50 px-4 py-10 sm:py-16">
      <div className="mx-auto mb-8 max-w-xl text-center text-neutral-900">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Reserve a table</h1>
        <p className="mt-2 text-neutral-600">{info.name}</p>
      </div>
      {info.open ? (
        <TableReserveForm slug={slug} name={info.name} today={info.today} maxDate={info.maxDate} maxParty={info.cfg.maxParty} durationMins={info.cfg.durationMins} />
      ) : (
        <div className="mx-auto max-w-md rounded-3xl border border-black/10 bg-white p-7 text-center text-neutral-800">
          <p className="font-semibold">Online reservations aren't available right now.</p>
          <p className="mt-1 text-sm text-neutral-600">Please contact the restaurant directly to book a table.</p>
          <Link href={`/${slug}`} className="mt-5 inline-block text-sm font-semibold underline">Back to the menu</Link>
        </div>
      )}
    </main>
  );
}
