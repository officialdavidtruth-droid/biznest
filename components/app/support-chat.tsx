"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mail, LifeBuoy, UserRound } from "lucide-react";
import { answerQuestion, SUGGESTIONS } from "@/lib/support-faq";
import { SUPPORT_EMAIL } from "@/lib/constants/support";
import { submitSupportRequest } from "@/lib/actions/support-request";

type Msg = { role: "user" | "assistant"; content: string; handoff?: boolean; chips?: string[]; greeting?: boolean };

const STORE_KEY = "bn-support-chat:v2";
const GREETING: Msg = {
  role: "assistant",
  content: "Hi! I'm the BizNest help assistant. Ask me how to do anything in your dashboard, or tap a question below.",
  greeting: true,
};

function mailto(msgs: Msg[]) {
  const transcript = msgs
    .filter((m) => !m.greeting)
    .map((m) => `${m.role === "user" ? "Me" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  const subject = "BizNest support request";
  const body = `Hi BizNest team,\n\nI need help with:\n\n(please describe your issue)\n\n--- chat so far ---\n${transcript}`.slice(0, 1800);
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Support chat: instant answers from our own help content, one tap hands over to the BizNest team by email. */
export function SupportChat({ slug }: { slug: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (saved) setMsgs(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-30))); } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setBusy(true);
    const page = typeof location !== "undefined" ? location.pathname.replace(/^\/(store\/)?[^/]+\/admin/, "") || "/" : undefined;
    // Answers are instant and local; the short pause just feels natural.
    const delay = 350 + Math.min(content.length * 6, 450);
    window.setTimeout(() => {
      let r;
      try { r = answerQuestion(content, page); } catch { r = { reply: "Something went wrong on our side. Please tap \"Talk to a person\" and we will help.", handoff: true }; }
      setMsgs([...next, { role: "assistant", content: r.reply, handoff: r.handoff, chips: r.chips }]);
      setBusy(false);
    }, delay);
  }

  async function sendToTeam() {
    if (sending) return;
    setSending(true);
    setSendError(null);
    const transcript = msgs
      .filter((m) => !m.greeting)
      .map((m) => `${m.role === "user" ? "Me" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    try {
      const r = await submitSupportRequest(slug, note, transcript);
      if (r.success) { setSentId(r.data.id); setNote(""); }
      else setSendError(r.error);
    } catch {
      setSendError("Could not send right now. Please try again, or email us instead.");
    }
    setSending(false);
  }

  const showChips = msgs.length <= 1;

  return (
    <div className="flex h-[calc(100dvh-330px)] min-h-[300px] max-h-[600px] lg:h-[560px] flex-col overflow-hidden rounded-2xl border bg-background" data-no-pull>
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><LifeBuoy className="h-4 w-4" /></span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">BizNest help</p>
          <p className="hidden text-[11px] text-muted-foreground sm:block">Instant answers. A person is one tap away.</p>
        </div>
        <button type="button" onClick={() => setHandoffOpen(true)} className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium">
          <UserRound className="h-3.5 w-3.5" /> Talk to a person
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 select-text">
        {msgs.map((m, i) => (
          <div key={i} className={`bn-chat-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
            <div className={`w-fit whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}>
              {m.content}
              {m.handoff && (
                <button type="button" onClick={() => setHandoffOpen(true)} className="mt-2 flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-xs font-semibold text-primary">
                  <Mail className="h-3.5 w-3.5" /> Send this to the BizNest team
                </button>
              )}
            </div>
            {m.role === "assistant" && m.chips && i === msgs.length - 1 && !busy && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.chips.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)} className="rounded-full border px-3 py-1.5 text-left text-xs font-medium text-primary">{q}</button>
                ))}
              </div>
            )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3" aria-label="Assistant is typing">
              <span className="bn-typing-dot" /><span className="bn-typing-dot" style={{ animationDelay: ".15s" }} /><span className="bn-typing-dot" style={{ animationDelay: ".3s" }} />
            </div>
          </div>
        )}
        {showChips && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="rounded-full border px-3 py-1.5 text-xs font-medium text-primary">{q}</button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {handoffOpen && (
        <div className="shrink-0 space-y-2 border-t bg-muted/30 p-3">
          {sentId ? (
            <>
              <p className="text-sm font-medium">Sent. The BizNest team will reply to your account email.</p>
              <p className="text-xs text-muted-foreground">Reference: {sentId}</p>
              <button type="button" onClick={() => { setHandoffOpen(false); setSentId(null); }} className="rounded-full border px-3 py-1.5 text-xs font-medium">Close</button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Tell the team what you need</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Describe your problem. Your chat so far is included automatically."
                className="w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary/40 sm:text-sm"
              />
              {sendError && <p className="text-xs text-destructive">{sendError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={sendToTeam} disabled={sending || note.trim().length < 5} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                  {sending ? "Sending…" : "Send to BizNest team"}
                </button>
                <button type="button" onClick={() => setHandoffOpen(false)} className="rounded-full border px-3 py-2 text-xs font-medium">Cancel</button>
                <a href={mailto(msgs)} className="ml-auto text-xs text-muted-foreground underline">Email instead</a>
              </div>
            </>
          )}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex shrink-0 items-center gap-2 border-t p-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          maxLength={500}
          className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary/40 sm:text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
