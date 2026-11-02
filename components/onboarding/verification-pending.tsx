import Link from "next/link";
import { Check, Clock3, Mail, FileSearch, ShieldCheck, Store } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/constants/support";

type Props = {
  businessName: string;
  category: string;
  specialty?: string | null;
  location: string;
  submittedAt: Date;
  email: string;
};

const STEPS = [
  { title: "Application submitted", body: "We have your business details and documents.", state: "done" },
  { title: "Under review", body: "Our team is checking your documents. This usually takes 1–3 business days.", state: "current" },
  { title: "Decision by email", body: "You'll get an email as soon as you're approved, or a note on what to fix.", state: "upcoming" },
] as const;

const NEXT = [
  { icon: ShieldCheck, text: "Once approved, you'll accept our short fraud policy." },
  { icon: Store, text: "Then pick a plan and set up your store. Your specialty tailors your dashboard." },
];

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function VerificationPending({ businessName, category, specialty, location, submittedAt, email }: Props) {
  const details: Array<[string, string]> = [
    ["Business", businessName],
    ["Category", specialty ? `${category} · ${specialty}` : category],
    ["Location", location],
    ["Submitted", formatDate(submittedAt)],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">B</span>
          BizNest
        </Link>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-muted-foreground hover:text-foreground">Need help?</a>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-start justify-center px-4 pb-16 pt-6 sm:px-6 sm:pt-12">
        <div className="grid w-full gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* Status card */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(20,37,28,.04),0_12px_32px_-16px_rgba(20,37,28,.18)] sm:p-9">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              In review
            </span>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              Thanks, we're reviewing {businessName}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You don't need to do anything right now. We'll email <span className="font-medium text-foreground">{email}</span> with the decision.
            </p>

            <ol className="mt-8 space-y-0">
              {STEPS.map((step, i) => {
                const done = step.state === "done";
                const current = step.state === "current";
                const last = i === STEPS.length - 1;
                return (
                  <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
                    {!last && (
                      <span aria-hidden className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px ${done ? "bg-primary/40" : "bg-border"}`} />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs ${
                        done ? "border-primary bg-primary text-primary-foreground"
                        : current ? "border-primary bg-white text-primary ring-4 ring-primary/10"
                        : "border-border bg-white text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : current ? <Clock3 className="h-4 w-4" /> : i + 1}
                    </span>
                    <div className="pt-0.5">
                      <p className={`text-sm font-medium ${step.state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}>{step.title}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Side column */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-white p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileSearch className="h-4 w-4 text-primary" /> What you submitted
              </h2>
              <dl className="mt-4 divide-y divide-border text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6">
              <h2 className="text-sm font-semibold text-foreground">After approval</h2>
              <ul className="mt-4 space-y-3">
                {NEXT.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-[13px] leading-snug text-muted-foreground">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2.25} />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </section>

            <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Wrong details, or taking longer than 3 business days? Write to{" "}
                <a className="font-medium text-foreground underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </span>
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
