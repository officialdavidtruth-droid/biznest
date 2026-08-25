import { notFound } from "next/navigation";
import Link from "next/link";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getGeneralStoreConversation, listStoreDisputes } from "@/lib/actions/account";
import { DISPUTE_STATUS_CONFIG } from "@/lib/constants/dispute";
import { StoreComplaintThread } from "@/components/forms/store-complaint-thread";
import { ShieldAlert } from "lucide-react";

// Two distinct paths live here, on purpose:
//  - The complaint thread below is a free-form, non-order-tied conversation
//    with the seller -- for anything the customer can't attach to a visible
//    order (a missing order after a login glitch, a billing question, etc).
//  - The dispute list is the formal, order-tied case record (evidence,
//    admin review) opened from a specific order in "My Orders" -- surfaced
//    here too so a customer always has one place to see every open issue,
//    regardless of which of the two started it.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getStoreCustomerSessionForStore(slug);
  const store = await getStoreBranding(slug);
  if (!store || !session?.user?.id) notFound();

  const [conversation, disputes] = await Promise.all([
    getGeneralStoreConversation(slug),
    listStoreDisputes(slug),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Support</h1>
      <p className="mt-1 text-sm text-slate-500">Complaints and disputes with {store.name}.</p>

      <div className="mt-5">
        <StoreComplaintThread
          storeSlug={slug}
          storeName={store.name}
          currentUserId={session.user.id}
          conversationId={conversation?.id ?? null}
          messages={conversation?.messages ?? []}
        />
      </div>

      <div className="mt-8">
        <p className="text-sm font-semibold text-slate-900">Disputes</p>
        <p className="mt-0.5 text-xs text-slate-500">Formal disputes opened on a specific order.</p>
        <div className="mt-3 space-y-2.5">
          {disputes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No disputes opened yet. You can open one from an order in{" "}
              <Link href={`/store/${slug}/orders`} className="font-medium text-slate-700 underline">
                My Orders
              </Link>
              .
            </div>
          ) : (
            disputes.map((d) => {
              const cfg = DISPUTE_STATUS_CONFIG[d.status];
              return (
                <Link
                  key={d.id}
                  href={`/disputes/${d.order.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Order #{d.order.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {d.order.currency} {Number(d.order.total).toLocaleString()} ·{" "}
                        {new Date(d.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                    {cfg.label}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
    }
