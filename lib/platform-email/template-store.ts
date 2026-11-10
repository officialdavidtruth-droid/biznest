import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplate } from "@/lib/platform-email/default-templates";
import { isAudience } from "@/lib/platform-email/audience";

export const EMAIL_TEMPLATES_KEY = "EMAIL_TEMPLATES";

type Stored = { overrides?: Record<string, Partial<EmailTemplate>>; custom?: EmailTemplate[]; hidden?: string[] };
export type ListedTemplate = EmailTemplate & { kind: "default" | "edited" | "custom" };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function clean(t: Partial<EmailTemplate>, base?: EmailTemplate): EmailTemplate {
  const audience = typeof t.audience === "string" && isAudience(t.audience) ? t.audience : base?.audience ?? "ALL";
  return {
    id: base?.id ?? s(t.id, 60),
    category: s(t.category ?? base?.category ?? "My templates", 40) || "My templates",
    name: s(t.name ?? base?.name, 80),
    description: s(t.description ?? base?.description ?? "", 160),
    subject: s(t.subject ?? base?.subject, 150),
    body: s(t.body ?? base?.body, 8000),
    ctaLabel: s(t.ctaLabel ?? base?.ctaLabel ?? "", 40),
    ctaUrl: s(t.ctaUrl ?? base?.ctaUrl ?? "", 500),
    audience,
  };
}

export async function readStored(): Promise<Stored> {
  const row = await prisma.platformSetting.findUnique({ where: { key: EMAIL_TEMPLATES_KEY } });
  return ((row?.value ?? {}) as Stored) || {};
}

export async function writeStored(v: Stored) {
  const value = JSON.parse(JSON.stringify(v));
  await prisma.platformSetting.upsert({ where: { key: EMAIL_TEMPLATES_KEY }, create: { key: EMAIL_TEMPLATES_KEY, value }, update: { value } });
}

export async function listTemplates(): Promise<ListedTemplate[]> {
  const st = await readStored();
  const overrides = st.overrides ?? {};
  const defaults: ListedTemplate[] = DEFAULT_EMAIL_TEMPLATES.map((d) =>
    overrides[d.id] ? { ...clean({ ...d, ...overrides[d.id] }, d), kind: "edited" as const } : { ...d, kind: "default" as const }
  );
  const custom: ListedTemplate[] = (st.custom ?? []).map((c) => ({ ...clean(c, { ...c } as EmailTemplate), kind: "custom" as const }));
  return [...defaults, ...custom];
}

export { clean as cleanTemplate };
