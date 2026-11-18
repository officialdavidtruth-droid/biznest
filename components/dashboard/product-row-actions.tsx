"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Eye, EyeOff, Trash2, Rss } from "lucide-react";
import { toast } from "sonner";
import { bulkUpdateProducts } from "@/lib/actions/bulk";
import { deleteProduct } from "@/lib/actions/product";
import { shareProductToBrowse } from "@/lib/actions/browse-vendor";

export function ProductRowActions({
  storeSlug,
  productId,
  productName,
  isPublished,
  archived = false,
}: {
  storeSlug: string;
  productId: string;
  productName: string;
  isPublished: boolean;
  archived?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    const close = () => setOpen(false);
    document.addEventListener("click", onClick);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  function toggleMenu() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((v) => !v);
  }

  async function togglePublish() {
    setBusy(true);
    const result = await bulkUpdateProducts(storeSlug, [{ productId, isPublished: !isPublished }]);
    setBusy(false);
    setOpen(false);
    if (!result.success) return toast.error(result.error);
    toast.success(archived ? "Restored" : isPublished ? "Marked inactive" : "Marked active");
    router.refresh();
  }

  async function shareToBrowse() {
    const caption = window.prompt("Share this product on Browse. Add a caption (optional):", "");
    if (caption === null) return;
    setBusy(true);
    const result = await shareProductToBrowse(storeSlug, productId, caption);
    setBusy(false);
    setOpen(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Shared to Browse");
  }

  async function handleDelete() {
    if (!confirm(`Delete "${productName}"? This can't be undone.`)) return;
    setBusy(true);
    const result = await deleteProduct(storeSlug, productId);
    setBusy(false);
    setOpen(false);
    if (!result.success) return toast.error(result.error);
    toast.success(result.data?.archived ? "Has orders or stock history: archived instead of deleted. Find it under the Archived filter." : "Deleted");
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
          onClick={toggleMenu}
          disabled={busy}
          className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
          title="More"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {open && pos && typeof document !== "undefined" && createPortal(
          <div ref={menuRef} style={{ position: "fixed", top: pos.top, right: pos.right }} className="z-[1000] w-52 rounded-lg border bg-white py-1 shadow-lg">
            <button onClick={togglePublish} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
              {isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {archived ? "Restore" : isPublished ? "Mark inactive" : "Mark active"}
            </button>
            {!archived && isPublished && <button onClick={shareToBrowse} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
              <Rss className="h-3.5 w-3.5" /> Share to Browse
            </button>}
            {!archived && <button onClick={handleDelete} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
