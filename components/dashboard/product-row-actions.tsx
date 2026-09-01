"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkUpdateProducts } from "@/lib/actions/bulk";
import { deleteProduct } from "@/lib/actions/product";

export function ProductRowActions({
  storeSlug,
  productId,
  productName,
  isPublished,
}: {
  storeSlug: string;
  productId: string;
  productName: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  async function togglePublish() {
    setBusy(true);
    const result = await bulkUpdateProducts(storeSlug, [{ productId, isPublished: !isPublished }]);
    setBusy(false);
    setOpen(false);
    if (!result.success) return toast.error(result.error);
    toast.success(isPublished ? "Marked inactive" : "Marked active");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${productName}"? This can't be undone.`)) return;
    setBusy(true);
    const result = await deleteProduct(storeSlug, productId);
    setBusy(false);
    setOpen(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Deleted");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/${storeSlug}/admin/products/${productId}/edit`}
        className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground hover:bg-muted/50"
        title="Edit"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Link>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
          title="More"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {open && (
          <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border bg-white py-1 shadow-lg">
            <button onClick={togglePublish} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
              {isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {isPublished ? "Mark inactive" : "Mark active"}
            </button>
            <button onClick={handleDelete} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
