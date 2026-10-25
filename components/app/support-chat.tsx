"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mail, Sparkles, UserRound } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; handoff?: boolean };

const SUPPORT_EMAIL = "biznestsupport@gmail.com";
const STORE_KEY = "bn-support-chat:v1";
const SUGGESTIONS = [
  "How do I add my first product?",
  "How do I get paid out?",
  "How do I invite my staff?",
  "How do I install an app?",
];
const GREETING: Msg = {
  role: "assistant",
  content: "Hi! I'm the BizNest assistant. Ask me how to do anything in your dashboard, or tap a question below.",
};

function mailto(msgs: Msg[]) {
  const transcript = msgs
    .filter((m) => m !== GREETING)
    .map((m) => `${m.role === "user" ? "Me" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  const subject = "BizNest support request";
  const body = `Hi BizNest team,\n\nI need help with:\n\n(please describe your issue)\n\n--- chat so far ---\n${transcript}`.slice(0, 1800);
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Support chat: AI answers first, one tap hands over to the BizNest team by email. */
export function SupportChat() {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.filter((m) => m !== GREETING).map(({ role, content }) => ({ role, content })),
          page: typeof location !== "undefined" ? location.pathname.replace(/^\/(store\/)?[^/]+\/admin/, "") || "/" : undefined,
        }),
      });
      const data = (await res.json()) as { reply?: string; handoff?: boolean; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error || "Something went wrong.");
      setMsgs([...next, { role: "assistant", content: data.reply, handoff: data.handoff }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const showChips = msgs.length <= 1;

  return (
    <div className="flex h-[min(560px,calc(100dvh-220px))] min-h-[360px] flex-col overflow-hidden rounded-2xl border bg-background" data-no-pull>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">BizNest assistant</p>
          <p className="text-[11px] text-muted-foreground">Instant answers. A person is one tap away.</p>
        </div>
        <a href={mailto(msgs)} className="ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium">
          <UserRound className="h-3.5 w-3.5" /> Talk to a person
        </a>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 select-text">
        {msgs.map((m, i) => (
          <div key={i} className={`bn-chat-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}>
              {m.content}
              {m.handoff && (
                <a href={mailto(msgs.slice(0, i + 1))} className="mt-2 flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-xs font-semibold text-primary">
                  <Mail className="h-3.5 w-3.5" /> Send this to the BizNest team
                </a>
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
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error} You can also <a className="underline" href={mailto(msgs)}>email us</a>.
          </p>
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

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t p-3">
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
