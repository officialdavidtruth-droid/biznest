"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkSlugAvailability, updateStoreSlug } from "@/lib/actions/store";

/**
 * Lets a store owner shorten/rename their store's URL, e.g.
 * "truth-empire-logistics" -> "tel", any time from Settings. Checks
 * availability live as they type (debounced) and shows why a candidate is
 * rejected (taken, reserved, bad format) before they even hit save.
 *
 * `domainRoot` is just the host for display (e.g. "biznest.space") --
 * building the actual clickable URL still goes through storePublicUrl on
 * the server so it always matches NEXT_PUBLIC_APP_URL.
 */
export function StoreSlugEditor({ slug, domainRoot }: { slug: string; domainRoot: string }) {
  const router = useRouter();
  const [value, setValue] = useState(slug);
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const candidate = value.trim().toLowerCase();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (candidate === slug) {
      setAvailability(null);
      setChecking(false);
      return;
    }
    if (!candidate) {
      setAvailability(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const result = await checkSlugAvailability(slug, candidate);
      setAvailability(result);
      setChecking(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, slug]);

  const candidate = value.trim().toLowerCase();
  const isUnchanged = candidate === slug;
  const canSave = !isUnchanged && !checking && availability?.available === true;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("slug", candidate);
    const result = await updateStoreSlug(slug, formData);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Your store's URL is now ${domainRoot}/${result.data.slug}`);
    // Old links (biznest.space/<old-slug>) keep redirecting here — see
    // app/store/[slug]/layout.tsx — but this admin session is on the old
    // slug's URL right now, so move it forward to the new one.
    router.push(`/${result.data.slug}/admin/settings`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-1 text-sm font-medium">Store URL</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Shorten your storefront link — old links keep working automatically.
      </p>
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap text-sm text-muted-foreground">{domainRoot}/</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          className="flex-1 rounded-md border px-3 py-1.5 text-sm font-mono"
          maxLength={63}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {!isUnchanged && (
        <p className={`mt-2 text-xs ${
          checking ? "text-muted-foreground"
          : availability?.available ? "text-green-700"
          : "text-destructive"
        }`}>
          {checking
            ? "Checking availability…"
            : availability?.available
            ? "Available"
            : availability?.reason ?? ""}
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Heads up: if you have staff, their login (e.g. "name@{slug}") will change to use the new URL —
        share the new one with them after saving.
      </p>
    </div>
  );
}
