"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw, Bot, UserRound } from "lucide-react";
import { saveMessagingConfig, resetMessagingConfig } from "@/lib/actions/store-chat";
import type { MessagingConfig, StoreFaq } from "@/lib/store-chat";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function FaqEditor({ slug, initial, businessType, customized }: { slug: string; initial: MessagingConfig; businessType: string; customized: boolean }) {
  const [config, setConfig] = useState<MessagingConfig>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  function update(next: MessagingConfig) {
    setConfig(next);
    setDirty(true);
  }
  function patchFaq(id: string, patch: Partial<StoreFaq>) {
    update({ ...config, faqs: config.faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }
  function addFaq() {
    update({ ...config, faqs: [...config.faqs, { id: `n${Date.now().toString(36)}`, topic: "General", question: "", answer: "", enabled: true }] });
  }
  function save() {
    const incomplete = config.faqs.some((f) => !f.question.trim() || !f.answer.trim());
    if (incomplete) {
      toast.error("Fill in every question and answer, or delete the empty ones.");
      return;
    }
    start(async () => {
      const r = await saveMessagingConfig(slug, config);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setDirty(false);
      toast.success("Saved. Customers see the changes now.");
    });
  }
  function reset() {
    if (!window.confirm(`Replace your questions with the ready-made ${businessType} set? Your edits will be lost.`)) return;
    start(async () => {
      const r = await resetMessagingConfig(slug);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setConfig(r.data.config);
      setDirty(false);
      toast.success("Ready-made questions restored.");
    });
  }

  const topics = Array.from(new Set(config.faqs.map((f) => f.topic).filter(Boolean)));

  return (
    <div className="mt-6 space-y-5 pb-24">
      <div className="divide-y rounded-xl border bg-background shadow-sm">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex gap-3">
            <Bot className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Answer common questions automatically</p>
              <p className="text-sm text-muted-foreground">Sends the matching answer right away. Stops once a team member replies.</p>
            </div>
          </div>
          <Toggle checked={config.autoReply} onChange={(v) => update({ ...config, autoReply: v })} label="Automatic answers" />
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex gap-3">
            <UserRound className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Let customers talk to a human</p>
              <p className="text-sm text-muted-foreground">Adds a &quot;Talk to a human&quot; button. Those chats jump to the top of your inbox and you get notified.</p>
            </div>
          </div>
          <Toggle checked={config.humanHandoff} onChange={(v) => update({ ...config, humanHandoff: v })} label="Talk to a human" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {customized ? "Your questions" : `Ready-made questions for ${businessType}`} · edit the answers to match your business (prices, times, policies).
        </p>
        <button type="button" onClick={reset} disabled={pending} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50">
          <RotateCcw className="h-3.5 w-3.5" /> Restore defaults
        </button>
      </div>

      <datalist id="faq-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>

      <div className="space-y-3">
        {config.faqs.map((f) => (
          <div key={f.id} className={`rounded-xl border bg-background p-4 shadow-sm transition ${f.enabled ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex gap-2">
                  <input
                    value={f.question}
                    onChange={(e) => patchFaq(f.id, { question: e.target.value })}
                    placeholder="Question customers ask"
                    maxLength={200}
                    aria-label="Question"
                    className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm font-medium"
                  />
                  <input
                    value={f.topic}
                    onChange={(e) => patchFaq(f.id, { topic: e.target.value })}
                    list="faq-topics"
                    placeholder="Topic"
                    maxLength={60}
                    aria-label="Topic this chat is filed under"
                    className="h-10 w-36 shrink-0 rounded-lg border bg-muted/40 px-3 text-sm"
                  />
                </div>
                <textarea
                  value={f.answer}
                  onChange={(e) => patchFaq(f.id, { answer: e.target.value })}
                  placeholder="The automatic answer"
                  rows={3}
                  maxLength={1500}
                  aria-label="Automatic answer"
                  className="w-full rounded-lg border bg-background p-3 text-sm"
                />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-3 pt-1">
                <Toggle checked={f.enabled} onChange={(v) => patchFaq(f.id, { enabled: v })} label="Show this question" />
                <button type="button" onClick={() => update({ ...config, faqs: config.faqs.filter((x) => x.id !== f.id) })} aria-label="Delete question" className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addFaq} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
          <Plus className="h-4 w-4" /> Add a question
        </button>
      </div>

      <div className={`fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur transition ${dirty ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">You have unsaved changes</span>
          <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
