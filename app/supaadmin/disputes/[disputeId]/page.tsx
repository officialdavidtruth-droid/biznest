import { getDisputeForAdmin } from "@/lib/actions/admin";
import { notFound } from "next/navigation";
import { AdminDisputeDecision } from "@/components/dashboard/admin-dispute-decision";
import { DISPUTE_STATUS_CONFIG } from "@/lib/constants/dispute";

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;
  const result = await getDisputeForAdmin(disputeId);
  if (!result) notFound();

  const { dispute, messages } = result;
  const order = dispute.order;
  const address = order.shippingAddress as {
    fullName: string; phone: string; address: string; city: string; state: string; country: string;
  } | null;
  const photos = dispute.evidence.filter((e) => e.fileUrl);
  const notes = dispute.evidence.filter((e) => e.note);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Order #{order.id.slice(-8).toUpperCase()}</h1>
          <p className="text-sm text-muted-foreground">
            {order.buyer.name ?? order.buyer.email} vs. {order.store.business.businessName} ({order.store.name})
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${DISPUTE_STATUS_CONFIG[dispute.status].bg} ${DISPUTE_STATUS_CONFIG[dispute.status].text} ${DISPUTE_STATUS_CONFIG[dispute.status].ring}`}
        >
          {DISPUTE_STATUS_CONFIG[dispute.status].label}
        </span>
      </div>

      <Section title="Reason">
        <p className="mb-1 text-xs text-muted-foreground">
          Opened by {dispute.raisedById === order.buyerId ? "buyer" : "seller"} ({dispute.raisedBy.name ?? dispute.raisedBy.email}) ·{" "}
          {new Date(dispute.createdAt).toLocaleString()}
        </p>
        <p className="text-sm">{dispute.reason}</p>
      </Section>

      <Section title="Order">
        <Grid>
          <Field label="Total" value={`${order.currency} ${Number(order.total).toLocaleString()}`} />
          <Field label="Commission" value={`${order.currency} ${Number(order.commission).toLocaleString()}`} />
          <Field label="Current status" value={order.status.replace("_", " ")} />
          <Field label="Placed" value={new Date(order.createdAt).toLocaleString()} />
        </Grid>
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Items</p>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1 text-sm">
              <span>{item.product?.name ?? item.service?.name} × {item.quantity}</span>
              <span>{order.currency} {(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Evidence — photos">
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos submitted.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <a key={p.id} href={p.fileUrl!} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.fileUrl!} alt="" className="aspect-square w-full rounded-md border object-cover" />
                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                  {p.submittedBy.id === order.buyerId ? "Buyer" : "Seller"} · {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title="Evidence — notes">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes submitted.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-md border p-3 text-sm">
                <p>{n.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.submittedBy.id === order.buyerId ? "Buyer" : "Seller"} ({n.submittedBy.name ?? n.submittedBy.email}) ·{" "}
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Messages">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages between the buyer and seller yet.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {messages.map((m) => (
              <div key={m.id} className="rounded-md bg-muted/40 p-2.5 text-sm">
                <p>{m.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.senderId === order.buyerId ? "Buyer" : "Seller"} ({m.sender.name ?? "—"}) ·{" "}
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Delivery information">
        {address ? (
          <div className="mb-3 text-sm">
            <p className="font-medium">{address.fullName} · {address.phone}</p>
            <p className="text-muted-foreground">
              {address.address}, {address.city}, {address.state}, {address.country}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">No shipping address on file.</p>
        )}
        {order.deliveryZone && (
          <p className="mb-3 text-sm text-muted-foreground">
            Delivery zone: {order.deliveryZone.name} ({order.currency} {Number(order.deliveryZone.fee).toLocaleString()})
          </p>
        )}
        <ol className="space-y-1.5 border-l pl-3">
          {order.statusEvents.map((ev) => (
            <li key={ev.id} className="text-sm">
              <span className="font-medium">{ev.status.replace("_", " ")}</span>
              {" — "}
              <span className="text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</span>
              {ev.note && <span className="text-muted-foreground"> ({ev.note})</span>}
            </li>
          ))}
          {order.statusEvents.length === 0 && <li className="text-sm text-muted-foreground">No status history recorded.</li>}
        </ol>
      </Section>

      <Section title="Payment information">
        {order.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment records found.</p>
        ) : (
          <div className="space-y-2">
            {order.payments.map((p) => (
              <div key={p.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.provider} · {p.reference}</span>
                  <span className="text-xs text-muted-foreground">{p.status}</span>
                </div>
                <p className="text-muted-foreground">{p.currency} {Number(p.amount).toLocaleString()}</p>
                {p.verifiedAt && <p className="text-xs text-muted-foreground">Verified {new Date(p.verifiedAt).toLocaleString()}</p>}
                {p.refundedAt && (
                  <p className="text-xs text-muted-foreground">
                    Refunded {new Date(p.refundedAt).toLocaleString()} by {p.refundedByEmail ?? "—"} — {p.refundReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Decision">
        <AdminDisputeDecision disputeId={dispute.id} status={dispute.status} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border bg-background p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
