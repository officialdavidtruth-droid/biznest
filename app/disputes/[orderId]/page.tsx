import Link from "next/link";
import { notFound } from "next/navigation";
import { getDisputeThread } from "@/lib/actions/dispute";
import { OpenDisputeForm } from "@/components/dispute/open-dispute-form";
import { DisputeEvidenceForm } from "@/components/dispute/dispute-evidence-form";
import { DisputeMessageForm } from "@/components/dispute/dispute-message-form";
import { DISPUTE_STATUS_CONFIG } from "@/lib/constants/dispute";
import {
  ArrowLeft, ShieldAlert, Camera, StickyNote, MessageSquare,
  Truck, CreditCard, Gavel, User as UserIcon, Store as StoreIcon,
} from "lucide-react";

export default async function DisputeThreadPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const thread = await getDisputeThread(orderId);
  if (!thread) notFound();

  const { viewer, viewerId, canOpen, order, dispute, statusEvents, payments, messages } = thread;
  const otherPartyLabel = viewer === "buyer" ? order.store.name : order.buyer.name ?? order.buyer.email;
  const address = order.shippingAddress as {
    fullName: string; phone: string; address: string; city: string; state: string; country: string;
  } | null;

  const photos = dispute?.evidence.filter((e) => e.fileUrl) ?? [];
  const notes = dispute?.evidence.filter((e) => e.note) ?? [];
  const isActive = dispute?.status === "OPEN" || dispute?.status === "UNDER_REVIEW";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white pb-16">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to orders
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Order #{orderId.slice(-8).toUpperCase()}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {viewer === "buyer" ? "with" : "from"} {otherPartyLabel} · {order.currency} {Number(order.total).toLocaleString()}
            </p>
          </div>
          {dispute && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${DISPUTE_STATUS_CONFIG[dispute.status].bg} ${DISPUTE_STATUS_CONFIG[dispute.status].text} ${DISPUTE_STATUS_CONFIG[dispute.status].ring}`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {DISPUTE_STATUS_CONFIG[dispute.status].label}
            </span>
          )}
        </div>

        {!dispute && (
          <>
            {canOpen ? (
              <OpenDisputeForm orderId={orderId} viewer={viewer} />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                This order isn&apos;t eligible for a dispute right now (status: {order.status.replace("_", " ").toLowerCase()}).
              </div>
            )}
          </>
        )}

        {dispute && (
          <div className="space-y-5">
            {/* ---------- Admin decision, if resolved ---------- */}
            {dispute.adminNotes && (
              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  <Gavel className="h-3.5 w-3.5" /> BizNest decision
                </div>
                <p className="text-sm leading-relaxed">{dispute.adminNotes}</p>
                {dispute.resolvedAt && (
                  <p className="mt-2 text-xs text-slate-400">
                    Decided {new Date(dispute.resolvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* ---------- Reason ---------- */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Opened by {dispute.raisedById === order.buyerId ? "buyer" : "seller"} · {new Date(dispute.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-slate-800">{dispute.reason}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* ---------- Evidence: photos ---------- */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Camera className="h-4 w-4" /> Photos
                </h2>
                {photos.length === 0 ? (
                  <p className="text-xs text-slate-400">No photos submitted yet.</p>
                ) : (
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {photos.map((p) => (
                      <a key={p.id} href={p.fileUrl!} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.fileUrl!} alt="" className="aspect-square w-full rounded-lg border object-cover" />
                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {p.submittedBy.id === order.buyerId ? "Buyer" : "Seller"} · {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </a>
                    ))}
                  </div>
                )}

                <h3 className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <StickyNote className="h-3.5 w-3.5" /> Notes
                </h3>
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-400">No notes yet.</p>
                ) : (
                  <ul className="mb-3 space-y-2">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                        <p>{n.note}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {n.submittedBy.id === order.buyerId ? "Buyer" : "Seller"} · {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {isActive && <DisputeEvidenceForm orderId={orderId} />}
              </section>

              {/* ---------- Messages ---------- */}
              <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <MessageSquare className="h-4 w-4" /> Messages
                </h2>
                <div className="mb-3 max-h-64 flex-1 space-y-2 overflow-y-auto">
                  {messages.length === 0 && <p className="text-xs text-slate-400">No messages yet.</p>}
                  {messages.map((m) => {
                    const mine = m.senderId === viewerId;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                            mine ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          <p>{m.content}</p>
                          <p className={`mt-1 text-[10px] ${mine ? "text-slate-300" : "text-slate-400"}`}>
                            {m.sender.name ?? "—"} · {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {dispute.status !== "CLOSED" ? (
                  <DisputeMessageForm orderId={orderId} />
                ) : (
                  <p className="text-xs text-slate-400">This dispute is closed — messaging is disabled.</p>
                )}
              </section>

              {/* ---------- Delivery information ---------- */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Truck className="h-4 w-4" /> Delivery information
                </h2>
                {address ? (
                  <div className="mb-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{address.fullName} · {address.phone}</p>
                    <p>{address.address}, {address.city}, {address.state}, {address.country}</p>
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-slate-400">No shipping address on file.</p>
                )}
                {order.deliveryZone && (
                  <p className="mb-3 text-xs text-slate-500">
                    Delivery zone: {order.deliveryZone.name} ({order.currency} {Number(order.deliveryZone.fee).toLocaleString()})
                  </p>
                )}
                <ol className="space-y-1.5 border-l border-slate-200 pl-3">
                  {statusEvents.map((ev) => (
                    <li key={ev.id} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{ev.status.replace("_", " ")}</span>
                      {" — "}
                      {new Date(ev.createdAt).toLocaleString()}
                      {ev.note && <span className="text-slate-400"> ({ev.note})</span>}
                    </li>
                  ))}
                  {statusEvents.length === 0 && <li className="text-xs text-slate-400">No status history recorded yet.</li>}
                </ol>
              </section>

              {/* ---------- Payment information ---------- */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <CreditCard className="h-4 w-4" /> Payment information
                </h2>
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-400">No payment records found.</p>
                ) : (
                  <ul className="space-y-2">
                    {payments.map((p) => (
                      <li key={p.id} className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800">{p.provider}</span>
                          <span
                            className={
                              p.status === "SUCCESSFUL"
                                ? "text-emerald-600"
                                : p.status === "REFUNDED"
                                ? "text-amber-600"
                                : p.status === "FAILED"
                                ? "text-red-600"
                                : "text-slate-500"
                            }
                          >
                            {p.status}
                          </span>
                        </div>
                        <p>{p.currency} {Number(p.amount).toLocaleString()}</p>
                        {p.verifiedAt && <p className="text-slate-400">Verified {new Date(p.verifiedAt).toLocaleString()}</p>}
                        {p.refundedAt && <p className="text-amber-600">Refunded {new Date(p.refundedAt).toLocaleString()}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* ---------- Parties ---------- */}
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white p-3">
                <UserIcon className="h-3.5 w-3.5" /> Buyer: {order.buyer.name ?? order.buyer.email}
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white p-3">
                <StoreIcon className="h-3.5 w-3.5" /> Seller: {order.store.business.businessName}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
