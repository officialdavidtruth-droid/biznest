"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Click-to-edit inside the Customize preview. Wrap a piece of text (<Editable>) or a block (<EditRegion>) and,
 * only while the page is framed by its own Customize editor:
 *  - hovering outlines it, and clicking it asks the editor to open that field (instead of following links);
 *  - as the owner types in the editor, the new text appears here immediately (BIZNEST_PAGE_DRAFT).
 * On the live storefront it renders as plain text/markup with no handlers.
 */
function inOwnPreview(): boolean {
  try {
    if (window.self === window.top) return false;
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

const OUTLINE = `[data-bn-edit]{cursor:pointer;transition:outline-color .12s ease,background-color .12s ease;outline:2px dashed transparent;outline-offset:3px;border-radius:4px}[data-bn-edit]:hover{outline-color:#16a34a;background-color:rgba(22,163,74,.08)}`;

function useEditMode() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(inOwnPreview()), []);
  return on;
}

function ask(page: string, field: string, e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  window.parent?.postMessage({ type: "BIZNEST_CUSTOMIZER_EDIT_FIELD", page, field }, window.location.origin);
}

/** Text the owner can click to edit and see change live. Falls back to `value` when the draft is empty. */
export function Editable({ page, field, value }: { page: string; field: string; value: string }) {
  const edit = useEditMode();
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    if (!edit) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const d = event.data;
      if (!d || d.type !== "BIZNEST_PAGE_DRAFT" || d.page !== page || !d.fields || typeof d.fields !== "object") return;
      if (field in d.fields) setDraft(typeof d.fields[field] === "string" ? d.fields[field] : null);
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "BIZNEST_PAGE_DRAFT_REQUEST", page }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [edit, page, field]);

  const shown = edit && draft !== null && draft.trim() !== "" ? draft : value;
  if (!edit) return <>{shown}</>;
  return (
    <>
      <style>{OUTLINE}</style>
      <span data-bn-edit={field} title="Click to edit" onClickCapture={(e) => ask(page, field, e)}>{shown}</span>
    </>
  );
}

/** A block the owner can click to open its editor (live text updates aren't available for it, so it refreshes on save). */
export function EditRegion({ page, field, children }: { page: string; field: string; children: ReactNode }) {
  const edit = useEditMode();
  if (!edit) return <>{children}</>;
  return (
    <div data-bn-edit={field} title="Click to edit" onClickCapture={(e) => ask(page, field, e)}>
      <style>{OUTLINE}</style>
      {children}
    </div>
  );
}
