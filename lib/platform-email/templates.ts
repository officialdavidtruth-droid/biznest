export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}

/** Turns plain text into paragraphs (blank line = new paragraph, single newline = line break). */
export function textToParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:24px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function ctaButton(label: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
    <tr><td align="center" style="border-radius:8px;background-color:#0f6410;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td></tr></table>`;
}

/** Only https links or paths on our own site are allowed as a campaign button target. */
export function safeCtaUrl(url: string | null | undefined, appUrl: string) {
  const u = (url ?? "").trim();
  if (!u) return null;
  if (u.startsWith("/") && !u.startsWith("//")) return `${appUrl}${u}`;
  return /^https:\/\/[^\s]+$/i.test(u) ? u : null;
}

export type ReminderStage = 1 | 2 | 3;

export type ReminderCopy = { subject: string; preheader: string; body: string; ctaLabel: string; path: string };

/** Copy for the signup reminders. `hasBusiness` = business application approved, store not opened. */
export function reminderCopy(stage: ReminderStage, hasBusiness: boolean, firstName: string): ReminderCopy {
  const hi = `Hi ${firstName},`;
  if (hasBusiness) {
    const subjects = {
      1: "Your business is approved — open your store",
      2: "Your BizNest store is ready to set up",
      3: "Your approved business is still waiting for a store",
    } as const;
    const intros = {
      1: "Your business has been approved on BizNest. The last step is to open your store: choose a name, pick a template and add your first products.",
      2: "Your business is approved, but your store isn't open yet. Setting it up takes a few minutes, and you can change anything later.",
      3: "Your approved business still has no store. When you're ready, you can open it in a few minutes and start taking orders.",
    } as const;
    return {
      subject: subjects[stage],
      preheader: intros[stage].slice(0, 90),
      body: textToParagraphs(`${hi}\n\n${intros[stage]}\n\nIf anything is unclear, reply to this email and we'll help.`),
      ctaLabel: "Open your store",
      path: "/onboarding/create-store",
    };
  }
  const subjects = {
    1: "Start your BizNest store",
    2: "Need a hand opening your store?",
    3: "Your BizNest setup is still waiting",
  } as const;
  const intros = {
    1: "You've joined BizNest but haven't started your store yet. It takes about 10 minutes: tell us about your business, get verified, then pick a template and add your products.",
    2: "Opening a store on BizNest is quick: share a few details about your business, get verified, then choose a template and add what you sell. If you got stuck, reply to this email and we'll help.",
    3: "This is our last reminder. Your BizNest account is ready whenever you are: verify your business and open your store in a few minutes.",
  } as const;
  return {
    subject: subjects[stage],
    preheader: intros[stage].slice(0, 90),
    body: textToParagraphs(`${hi}\n\n${intros[stage]}`),
    ctaLabel: "Continue setup",
    path: "/onboarding/business-verification",
  };
}
