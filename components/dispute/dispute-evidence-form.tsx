"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDisputeEvidence } from "@/lib/actions/dispute";
import { toast } from "sonner";

export function DisputeEvidenceForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      setFileUrl(body.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    const result = await addDisputeEvidence(orderId, { fileUrl: fileUrl || undefined, note: note || undefined });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Evidence added.");
    setNote("");
    setFileUrl("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-3">
      {fileUrl && !isUploading && (
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl} alt="" className="h-14 w-14 rounded-lg border object-cover" />
          <button type="button" onClick={() => setFileUrl("")} className="text-xs text-slate-500 underline">
            Remove
          </button>
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="mb-2 block w-full text-xs"
      />
      {isUploading && <p className="mb-2 text-xs text-slate-400">Uploading…</p>}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note to go with this evidence (optional if you attached a photo)"
        className="mb-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
        rows={2}
      />
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || isUploading || (!note.trim() && !fileUrl)}
        className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? "Adding…" : "Add evidence"}
      </button>
    </div>
  );
}
