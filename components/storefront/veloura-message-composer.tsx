"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startStoreConversation, sendStoreMessage } from "@/lib/actions/account";
import { askFaq, requestHumanAgent } from "@/lib/actions/store-chat";
import { Send, UserRound } from "lucide-react";

export type ChatFaq = { id: string; question: string };

export function VelouraMessageComposer({
  slug,
  conversationId,
  faqs = [],
  humanHandoff = false,
  needsHuman = false,
}: {
  slug: string;
  conversationId: string | null;
  faqs?: ChatFaq[];
  humanHandoff?: boolean;
  needsHuman?: boolean;
}) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function run(task: () => Promise<{ success: boolean; error?: string }>, onOk?: () => void) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await task();
      if (!r.success) setError(r.error ?? "Something went wrong. Please try again.");
      else {
        onOk?.();
        router.refresh();
      }
    } catch {
      setError("Couldn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const text = v.trim();
    if (!text) return;
    run(() => (conversationId ? sendStoreMessage(slug, conversationId, text) : startStoreConversation(slug, text)), () => setV(""));
  }

  return (
    <div>
      {(faqs.length > 0 || humanHandoff) && (
        <div style={{ padding: "10px 12px 0", borderTop: "1px solid #eef0ed", background: "#fff" }}>
          <div style={{ fontSize: 11, color: "#6b7a72", marginBottom: 6 }}>Quick questions</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {faqs.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => run(() => askFaq(slug, f.id))}
                style={{ flexShrink: 0, border: "1px solid #cfdad3", background: "#f3f7f4", color: "#17402f", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
              >
                {f.question}
              </button>
            ))}
            {humanHandoff && (
              <button
                type="button"
                disabled={busy || needsHuman}
                onClick={() => run(() => requestHumanAgent(slug))}
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #17402f", background: needsHuman ? "#e8eeea" : "#17402f", color: needsHuman ? "#17402f" : "#fff", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: needsHuman ? "default" : "pointer" }}
              >
                <UserRound size={13} /> {needsHuman ? "Agent requested" : "Talk to a human"}
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert" style={{ margin: 0, padding: "6px 14px", fontSize: 12, color: "#b42318", background: "#fff" }}>{error}</p>}
      <div className="veloura-chat-form">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message…"
        />
        <button disabled={busy || !v.trim()} onClick={send} aria-label="Send message">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
