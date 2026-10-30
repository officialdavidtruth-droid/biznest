"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Copy, ImagePlus, Landmark, MessageCircle, Phone, RefreshCw } from "lucide-react";
import type { StorePalette } from "@/lib/store-palette-defaults";
import { PROOF_ACCEPT, PROOF_ALLOWED_TYPES, PROOF_MAX_BYTES, isImageProofUrl, formatPhoneDisplay, sameNumber, telLink, whatsappLink } from "@/lib/payments/manual-transfer";

type Info = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  note: string | null;
  whatsapp: string | null;
  call: string | null;
};

/** Shrinks big phone photos so the upload stays under the serverless body limit. */
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= 1.2 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function ManualPaymentPanel({
  slug,
  orderId,
  reference,
  subject,
  orderCode,
  storeName,
  totalLabel,
  info,
  initialProofUrl,
  palette,
}: {
  slug: string;
  /** Order checkout identifies the payment by order id; every other purpose by payment reference. */
  orderId?: string;
  reference?: string;
  /** What is being paid, e.g. "invoice #AB12CD34". Defaults to the order. */
  subject?: string;
  orderCode: string;
  storeName: string;
  totalLabel: string;
  info: Info;
  initialProofUrl: string | null;
  palette: StorePalette;
}) {
  const { accent, onAccent, ink, surface, card } = palette;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(initialProofUrl);

  const what = subject ?? `order #${orderCode}`;
  // Watch for the vendor's confirmation and move the customer on as soon as it lands.
  useEffect(() => {
    let stopped = false;
    const query = reference ? `reference=${encodeURIComponent(reference)}` : `orderId=${encodeURIComponent(orderId ?? "")}`;
    async function check() {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch(`/api/store/${encodeURIComponent(slug)}/payment-status?${query}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { paid?: boolean; redirectUrl?: string | null };
        if (!json.paid || stopped) return;
        stopped = true;
        toast.success("Payment confirmed!");
        if (json.redirectUrl) router.push(json.redirectUrl);
        else router.refresh();
      } catch {
        /* try again on the next tick */
      }
    }
    const timer = window.setInterval(check, 5000);
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, reference, orderId, router]);

  const wa = whatsappLink(
    info.whatsapp,
    `Hello ${storeName}, I've paid ${totalLabel} for ${what}. Please confirm my payment.`
  );
  const tel = telLink(info.call);
  // One line that does both jobs gets one row with both buttons instead of the number twice.
  const sameLine = Boolean(wa && tel && sameNumber(info.whatsapp, info.call));
  const hasContact = Boolean(wa || tel);

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(info.accountNumber);
      toast.success("Account number copied");
    } catch {
      toast.error("Couldn't copy. Select the number and copy it manually.");
    }
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    if (!(PROOF_ALLOWED_TYPES as readonly string[]).includes(chosen.type)) {
      toast.error("Choose an image or a document (PDF, Word, Excel, text).");
      return;
    }
    const ready = chosen.type.startsWith("image/") ? await shrinkImage(chosen) : chosen;
    if (ready.size > PROOF_MAX_BYTES) {
      toast.error("That file is too large (4MB max). Try a smaller file.");
      return;
    }
    setFile(ready);
    setPreview(ready.type.startsWith("image/") ? URL.createObjectURL(ready) : null);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      if (!reference) body.set("orderId", orderId ?? "");
      body.set("file", file);
      if (note.trim()) body.set("note", note.trim());
      const query = reference ? `?reference=${encodeURIComponent(reference)}` : "";
      const res = await fetch(`/api/store/${encodeURIComponent(slug)}/payment-proof${query}`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        toast.error(json.error ?? "Upload failed. Please try again.");
        return;
      }
      setProofUrl(json.url);
      setFile(null);
      setPreview(null);
      toast.success("Payment proof sent to the store");
      router.refresh();
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const box = { background: card, border: `1px solid ${ink}14`, borderRadius: "1rem" } as const;

  return (
    <div className="space-y-5">
      <section style={box} className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Landmark className="h-4 w-4" style={{ color: accent }} />
          <h2 className="text-base font-bold">Pay by bank transfer</h2>
        </div>
        <p className="text-sm" style={{ opacity: 0.75 }}>
          Transfer exactly <b>{totalLabel}</b> to the account below, then upload your proof of payment (an image or a document, like a PDF receipt).
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ opacity: 0.55 }}>Bank</dt>
            <dd className="mt-1 font-semibold">{info.bankName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ opacity: 0.55 }}>Account name</dt>
            <dd className="mt-1 font-semibold">{info.accountName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ opacity: 0.55 }}>Account number</dt>
            <dd className="mt-1 flex items-center gap-2 font-semibold">
              <span className="tracking-wider">{info.accountNumber}</span>
              <button type="button" onClick={copyAccount} aria-label="Copy account number" style={{ color: accent }} className="rounded p-1 hover:opacity-70">
                <Copy className="h-4 w-4" />
              </button>
            </dd>
          </div>
        </dl>
        {info.note && (
          <p style={{ background: surface }} className="mt-4 rounded-lg px-4 py-3 text-sm">{info.note}</p>
        )}
        <p className="mt-4 text-xs" style={{ opacity: 0.6 }}>Use {what} as the transfer narration if your bank allows it.</p>
      </section>

      <section style={box} className="p-6">
        <div className="mb-3 flex items-center gap-2">
          {proofUrl ? <CheckCircle2 className="h-4 w-4" style={{ color: accent }} /> : <ImagePlus className="h-4 w-4" style={{ color: accent }} />}
          <h2 className="text-base font-bold">{proofUrl ? "Proof sent. Waiting for confirmation" : "Upload your payment proof"}</h2>
        </div>

        {proofUrl && (
          <div className="mb-4">
            {isImageProofUrl(proofUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proofUrl} alt="Your uploaded payment proof" className="max-h-64 rounded-lg border object-contain" style={{ borderColor: `${ink}22` }} />
            ) : (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: accent }} className="text-sm font-semibold underline">View the document you uploaded</a>
            )}
            <p className="mt-2 text-sm" style={{ opacity: 0.75 }}>
              {storeName} has been notified. Your payment is confirmed as soon as they see the money in their account. You can replace the file below if it was wrong.
            </p>
          </div>
        )}

        <input ref={fileRef} type="file" accept={PROOF_ACCEPT} onChange={pick} className="hidden" />
        {file && !preview && <p className="mb-3 text-sm font-semibold">Selected: {file.name}</p>}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected proof of payment" className="mb-3 max-h-64 rounded-lg border object-contain" style={{ borderColor: `${ink}22` }} />
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} style={{ border: `1px solid ${ink}33`, color: ink }} className="rounded-full px-5 py-2.5 text-sm font-semibold">
            {file ? "Choose a different file" : proofUrl ? "Replace file" : "Upload image or document"}
          </button>
          {file && (
            <button type="button" onClick={upload} disabled={busy} style={{ background: accent, color: onAccent }} className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
              {busy ? "Uploading…" : "Send proof"}
            </button>
          )}
        </div>
        {file && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Optional note (e.g. the name on the transfer)"
            style={{ background: surface, border: `1px solid ${ink}22`, color: ink }}
            className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm outline-none"
          />
        )}
      </section>

      <section style={box} className="p-6">
        <h2 className="mb-1 text-base font-bold">Taking a while to confirm?</h2>
        <p className="text-sm" style={{ opacity: 0.75 }}>
          {hasContact ? `Message or call ${storeName} directly and they can check their account.` : `Contact ${storeName} to confirm your payment.`}
        </p>

        {hasContact && (
          <ul className="mt-4 space-y-3">
            {sameLine ? (
              <li className="flex flex-wrap items-center gap-3">
                <div className="min-w-[10rem]">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ opacity: 0.55 }}>Call or WhatsApp</p>
                  <p className="mt-0.5 text-sm font-semibold">{formatPhoneDisplay(info.call)}</p>
                </div>
                <CallButton href={tel!} ink={ink} />
                <WhatsAppButton href={wa!} />
              </li>
            ) : (
              <>
                {wa && (
                  <li className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[10rem]">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ opacity: 0.55 }}>WhatsApp</p>
                      <p className="mt-0.5 text-sm font-semibold">{formatPhoneDisplay(info.whatsapp)}</p>
                    </div>
                    <WhatsAppButton href={wa} />
                  </li>
                )}
                {tel && (
                  <li className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[10rem]">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ opacity: 0.55 }}>Call line</p>
                      <p className="mt-0.5 text-sm font-semibold">{formatPhoneDisplay(info.call)}</p>
                    </div>
                    <CallButton href={tel} ink={ink} />
                  </li>
                )}
              </>
            )}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => router.refresh()} style={{ border: `1px solid ${ink}33`, color: ink }} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
            <RefreshCw className="h-4 w-4" /> Check status
          </button>
          <Link href={`/store/${slug}`} style={{ color: ink, opacity: 0.7 }} className="px-3 py-2.5 text-sm font-semibold no-underline">
            Back to store
          </Link>
        </div>
      </section>
    </div>
  );
}

function WhatsAppButton({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "#fff" }} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold no-underline">
      <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
    </a>
  );
}

function CallButton({ href, ink }: { href: string; ink: string }) {
  return (
    <a href={href} style={{ border: `1px solid ${ink}33`, color: ink }} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold no-underline">
      <Phone className="h-4 w-4" /> Call now
    </a>
  );
}
