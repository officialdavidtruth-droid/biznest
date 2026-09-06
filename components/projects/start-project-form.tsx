"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileImage, FileText, Loader2, Paperclip, X } from "lucide-react";
import { createCreativeProject, type ReferenceFile } from "@/lib/actions/creative-projects";

type StartProjectFormProps = {
  slug: string;
  services: string[];
  businessName: string;
};

const MAX_REFERENCE_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

export function StartProjectForm({ slug, services, businessName }: StartProjectFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);

  async function uploadReferences(files: FileList | null) {
    if (!files?.length) return;

    const selected = Array.from(files);
    if (referenceFiles.length + selected.length > MAX_REFERENCE_FILES) {
      toast.error(`You can upload up to ${MAX_REFERENCE_FILES} reference files.`);
      return;
    }

    const invalid = selected.find((file) => file.size > MAX_FILE_BYTES);
    if (invalid) {
      toast.error(`${invalid.name} is larger than 10MB.`);
      return;
    }

    setUploading(true);
    try {
      const uploaded: ReferenceFile[] = [];
      for (const file of selected) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(`/api/store/${encodeURIComponent(slug)}/quote-upload`, {
          method: "POST",
          body,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Could not upload ${file.name}.`);
        uploaded.push(result as ReferenceFile);
      }
      setReferenceFiles((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} reference file${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reference upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeReference(url: string) {
    setReferenceFiles((current) => current.filter((file) => file.url !== url));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);

    const result = await createCreativeProject(slug, {
      customerName: String(f.get("name") || ""),
      customerEmail: String(f.get("email") || "") || undefined,
      customerPhone: String(f.get("phone") || "") || undefined,
      serviceType: String(f.get("service") || ""),
      brief: String(f.get("brief") || ""),
      budget: Number(f.get("budget") || 0) || undefined,
      deadline: String(f.get("deadline") || "") || undefined,
      referenceFiles,
    });

    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Quote ${result.data.quoteNo} submitted successfully.`);
    router.push(`/store/${slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-background p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Get a quote from {businessName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us what you need, your expected budget and anything you want us to use as a reference. We&apos;ll review your request and prepare the right quote.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <input name="name" required className="input" placeholder="Your name" />
        <input name="email" type="email" className="input" placeholder="Email" />
        <input name="phone" className="input" placeholder="Phone / WhatsApp" />
        <select name="service" required className="input">
          <option value="">Select service</option>
          {services.map((service) => <option key={service}>{service}</option>)}
        </select>
        <input name="budget" type="number" min="0" className="input" placeholder="Your budget / amount (NGN)" />
        <input name="deadline" type="date" className="input" />
      </div>

      <textarea
        name="brief"
        required
        minLength={10}
        className="input min-h-36"
        placeholder="Describe exactly what you want us to achieve, including quantity, size, style, colours, deadline and any other requirements."
      />

      <div className="rounded-2xl border border-dashed p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Paperclip className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Add reference files</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload screenshots, sample designs, photos or PDFs. Up to 5 files, 10MB each.</p>
          </div>
          <button
            type="button"
            disabled={uploading || referenceFiles.length >= MAX_REFERENCE_FILES}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose files"}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={(e) => void uploadReferences(e.target.files)} />

        {referenceFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {referenceFiles.map((file) => (
              <div key={file.url} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                {file.type === "application/pdf" ? <FileText className="h-4 w-4 shrink-0 text-red-500" /> : <FileImage className="h-4 w-4 shrink-0 text-primary" />}
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button type="button" onClick={() => removeReference(file.url)} className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-destructive" aria-label={`Remove ${file.name}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button disabled={busy || uploading} className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "Submitting…" : "Submit quote request"}
      </button>

      <style jsx>{`.input{width:100%;border:1px solid hsl(var(--border));border-radius:.75rem;padding:.7rem .85rem;font-size:.875rem;background:transparent}`}</style>
    </form>
  );
}
