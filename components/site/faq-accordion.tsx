"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y" style={{ borderColor: "var(--bn-ink-line)" }}>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} style={{ borderColor: "var(--bn-ink-line)" }} className="border-t first:border-t-0">
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-6 py-5 text-left"
            >
              <span className="text-base font-medium sm:text-lg" style={{ color: "var(--bn-ivory)" }}>
                {item.q}
              </span>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition duration-300"
                style={{
                  border: "1px solid var(--bn-ink-line)",
                  transform: open ? "rotate(135deg)" : "rotate(0deg)",
                  color: "var(--bn-marigold)",
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </span>
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-5 text-sm leading-relaxed sm:text-base" style={{ color: "var(--bn-mute)" }}>
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
