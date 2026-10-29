"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Copy, ImagePlus, Landmark, MessageCircle, RefreshCw } from "lucide-react";
import type { StorePalette } from "@/lib/store-palette-defaults";
import { PROOF_ALLOWED_TYPES, PROOF_MAX_BYTES, whatsappLink } from "@/lib/payments/manual-transfer";

type Info = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  note: string | null;
  whatsapp: string | null;
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
  orderCode,
  storeName,
  totalLabel,
  info,
  initialProofUrl,
  palette,
}: {
  slug: string;
  orderId: string;
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

  const wa = whatsappLink(
    info.whatsapp,
    `Hello ${storeName}, I've paid ${totalLabel} for order #${orderCode}. Please confirm my payment.`
  );

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
      toast.error("Choose a JPG, PNG or WebP screenshot.");
      return;
    }
    const ready = await shrinkImage(chosen);
    if (ready.size > PROOF_MAX_BYTES) {
      toast.error("That image is too large. Try a smaller screenshot.");
      return;
    }
    setFile(ready);
    setPreview(URL.createObjectURL(ready));
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("orderId", orderId);
      body.set("file", file);
      if (note.trim()) body.set("note", note.trim());
      const res = await fetch(`/api/store/${encodeURIComponent(slug)}/payment-proof`, { method: "POST", body });
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
          Transfer exactly <b>{totalLabel}</b> to the account below, then upload a screenshot of your payment.
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
        <p className="mt-4 text-xs" style={{ opacity: 0.6 }}>Use order #{orderCode} as the transfer narration if your bank allows it.</p>
      </section>

      <section style={box} className="p-6">
        <div className="mb-3 flex items-center gap-2">
          {proofUrl ? <CheckCircle2 className="h-4 w-4" style={{ color: accent }} /> : <ImagePlus className="h-4 w-4" style={{ color: accent }} />}
          <h2 className="text-base font-bold">{proofUrl ? "Proof sent. Waiting for confirmation" : "Upload your payment proof"}</h2>
        </div>

        {proofUrl && (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofUrl} alt="Your uploaded payment proof" className="max-h-64 rounded-lg border object-contain" style={{ borderColor: `${ink}22` }} />
            <p className="mt-2 text-sm" style={{ opacity: 0.75 }}>
              {storeName} has been notified. Your order is confirmed as soon as they see the money in their account. You can replace the screenshot below if it was wrong.
            </p>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="hidden" />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected screenshot" className="mb-3 max-h-64 rounded-lg border object-contain" style={{ borderColor: `${ink}22` }} />
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} style={{ border: `1px solid ${ink}33`, color: ink }} className="rounded-full px-5 py-2.5 text-sm font-semibold">
            {file ? "Choose a different image" : proofUrl ? "Replace screenshot" : "Choose screenshot"}
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
          {wa ? `Message ${storeName} directly on WhatsApp and they can check their account.` : `Contact ${storeName} to confirm your payment.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "#fff" }} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold no-underline">
              <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
            </a>
          )}
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
