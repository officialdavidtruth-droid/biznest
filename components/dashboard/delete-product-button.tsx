"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/lib/actions/product";
import { toast } from "sonner";

export function DeleteProductButton({
  storeSlug,
  productId,
  productName,
}: {
  storeSlug: string;
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${productName}"? This can't be undone.`)) return;
    setIsDeleting(true);
    const result = await deleteProduct(storeSlug, productId);
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Product deleted");
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
    >
      {isDeleting ? "Deleting…" : "Delete"}
    </button>
  );
}
