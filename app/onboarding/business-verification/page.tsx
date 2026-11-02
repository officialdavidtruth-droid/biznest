import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BusinessVerificationForm } from "@/components/forms/business-verification-form";
import { VerificationPending } from "@/components/onboarding/verification-pending";
import { ShieldCheck, Clock3, Lock } from "lucide-react";

const CHECKLIST = [
  { icon: ShieldCheck, text: "Protects buyers from fake or unlicensed sellers" },
  { icon: Clock3, text: "Reviewed in 1–3 business days" },
  { icon: Lock, text: "Your documents are never shown on your storefront" },
];

export default async function BusinessVerificationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding/business-verification");

  const existing = await prisma.business.findUnique({ where: { userId: session.user.id } });

  if (existing?.verificationStatus === "PENDING") {
    return (
      <VerificationPending
        businessName={existing.businessName}
        category={existing.category}
        specialty={existing.businessSubcategory}
        location={[existing.city, existing.state].filter(Boolean).join(", ")}
        submittedAt={existing.updatedAt}
        email={existing.email}
      />
    );
  }

  if (existing?.verificationStatus === "APPROVED") {
    redirect("/onboarding/fraud-policy");
  }

  return (
    <div className="bg-white">
      <div className="flex max-lg:flex-col">
        {/* Left rail — plain flex item, no sticky/h-screen/min-h-full.
            It stretches to match the form's height (flexbox's normal
            default) rather than staying pinned via position:sticky —
            that's a deliberate trade for robustness: sticky + a fixed
            viewport height was fragile (it silently assumed there was
            never an announcement banner eating into the available
            space, and broke in a few other ways besides). Content flows
            from the top with normal spacing instead of being split
            top/bottom, so any extra stretched height below it just
            reads as breathing room, not an abandoned gap. */}
        <aside className="relative flex w-full shrink-0 flex-col overflow-hidden bg-foreground px-6 py-8 text-background sm:px-10 sm:py-16 lg:w-[380px] lg:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.14]"
            style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
          />
          <div className="relative">
            <div className="mb-8 flex items-center gap-2 text-sm font-semibold tracking-tight text-background/90">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">B</span>
              BizNest
            </div>

            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-white sm:text-[32px]">
              Verify your business
            </h1>
            <p className="mt-3 max-w-xs text-[14.5px] leading-relaxed text-background/70">
              Every seller on BizNest completes this once. It's what lets buyers trust that
              you're a real business before they hand over their money.
            </p>

            <ul className="mt-6 space-y-3 sm:mt-9 sm:space-y-4">
              {CHECKLIST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-background/15 bg-white/5">
                    <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2.25} />
                  </span>
                  <span className="text-[13.5px] leading-snug text-background/85">{text}</span>
                </li>
              ))}
            </ul>

            <p className="relative mt-10 hidden text-xs leading-relaxed text-background/50 lg:block">
              Rejected once? You can review the note and resubmit as many times as you need.
            </p>
          </div>
        </aside>

        {/* Right — the actual form. Also full-bleed against the viewport;
            the content itself is capped at a comfortable reading width and
            centered, so text and inputs don't stretch edge-to-edge on a
            wide screen, without needing an outer "card" to do that job. */}
        <div className="min-w-0 flex-1 bg-white px-4 py-6 sm:px-10 sm:py-16 lg:px-16">
          <div className="mx-auto max-w-2xl">
            <BusinessVerificationForm
              existingRejection={existing?.verificationStatus === "REJECTED" ? existing.rejectionReason : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
