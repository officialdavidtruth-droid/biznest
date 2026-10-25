import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PAGE_GUIDES } from "@/lib/page-guides";

export const dynamic = "force-dynamic";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const HUMAN_MARKER = "[[HUMAN]]";

// Knowledge the assistant answers from: the same per-page guides shown by
// "Learn this page", so the two never disagree.
const KNOWLEDGE = Object.entries(PAGE_GUIDES)
  .map(([path, gd]) => `## ${gd.title} (menu path: ${path || "/"})\n${gd.intro}\n${gd.steps.map((s) => `- ${s.title}: ${s.body}`).join("\n")}`)
  .join("\n\n");

const SYSTEM = `You are BizNest's in-app support assistant for merchants who run an online store on BizNest (Nigeria). Be warm, brief and practical. Use short paragraphs or a short numbered list; no markdown headings.

Answer ONLY from the help content below and general common sense about using a dashboard. If you are not sure a feature exists, say so rather than inventing it. Tell the user where to find things in the dashboard menu (e.g. "Open Orders from the menu").
Never ask for or accept passwords, card numbers, PINs or OTP codes. If the user pastes one, tell them not to share it.
If the issue needs a person (payouts not arriving, disputes, refunds you cannot see how to do, account or verification problems, bugs, billing, anything you cannot resolve) give your best immediate tip if any, then end your reply with the exact marker ${HUMAN_MARKER} on its own line. Do not use the marker otherwise.
Suggest the "Learn this page" button (bottom right of each dashboard page) when someone is confused about a screen.

HELP CONTENT
${KNOWLEDGE}`;

// Small in-memory limiter (per server instance): 20 messages / 10 min / user.
const hits = new Map<string, number[]>();
function limited(id: string): boolean {
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(id, recent);
  return recent.length > 20;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (limited(session.user.id)) return NextResponse.json({ error: "You're sending messages quickly. Please wait a few minutes." }, { status: 429 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The assistant isn't set up yet. Please email support instead." }, { status: 503 });

  let body: { messages?: { role: string; content: string }[]; page?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 1500) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  // The API requires the first message to be from the user.
  while (messages.length && messages[0].role !== "user") messages.shift();

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: body.page ? `${SYSTEM}\n\nThe user is currently on this dashboard page: ${String(body.page).slice(0, 80)}` : SYSTEM,
        messages,
      }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the assistant. Please try again." }, { status: 502 });
  }
  if (!res.ok) return NextResponse.json({ error: "The assistant is busy. Please try again." }, { status: 502 });

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const raw = data.content?.find((b) => b.type === "text")?.text?.trim();
  if (!raw) return NextResponse.json({ error: "No answer came back. Please try again." }, { status: 502 });

  const handoff = raw.includes(HUMAN_MARKER);
  return NextResponse.json({ reply: raw.replace(HUMAN_MARKER, "").trim(), handoff });
}
