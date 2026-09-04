import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BusinessVerificationForm } from "@/components/forms/business-verification-form";
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
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f0] px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-[#e3ddce] bg-white p-10 text-center shadow-[0_1px_2px_rgba(20,37,28,.04),0_12px_32px_-16px_rgba(20,37,28,.18)]">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#154a32]/10">
            <Clock3 className="h-5 w-5 text-[#154a32]" strokeWidth={2} />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-[#14251c]">Your application is being reviewed</h1>
          <p className="text-sm leading-relaxed text-[#6b6355]">
            We're checking your business details and documents. This usually takes 1–3 business
            days, and we'll email you as soon as a decision is made.
          </p>
        </div>
      </div>
    );
  }

  if (existing?.verificationStatus === "APPROVED") {
    redirect("/onboarding/fraud-policy");
  }

  return (
    <div className="min-h-screen bg-[#faf7f0] px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto flex max-w-5xl overflow-hidden rounded-2xl border border-[#e3ddce] bg-white shadow-[0_1px_2px_rgba(20,37,28,.04),0_24px_60px_-24px_rgba(20,37,28,.25)] max-lg:flex-col">
        {/* Left rail — the one bold element on the page. Everything else
            (the form itself) stays disciplined and matches BizNest's normal
            admin styling, so filling this out still feels native. */}
        <aside className="relative flex w-full shrink-0 flex-col justify-between overflow-hidden bg-[#14251c] px-8 py-10 text-[#f4efe3] sm:px-10 sm:py-12 lg:w-[340px] lg:px-9">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.14]"
            style={{ background: "radial-gradient(circle, #b3872f 0%, transparent 70%)" }}
          />
          <div className="relative">
            <div className="mb-8 flex items-center gap-2 text-sm font-semibold tracking-tight text-[#f4efe3]/90">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#b3872f] text-xs font-bold text-[#14251c]">B</span>
              BizNest
            </div>

            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-white sm:text-[32px]">
              Verify your business
            </h1>
            <p className="mt-3 max-w-xs text-[14.5px] leading-relaxed text-[#c9c2ae]">
              Every seller on BizNest completes this once. It's what lets buyers trust that
              you're a real business before they hand over their money.
            </p>

            <ul className="mt-9 space-y-4">
              {CHECKLIST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#f4efe3]/15 bg-white/5">
                    <Icon className="h-3.5 w-3.5 text-[#b3872f]" strokeWidth={2.25} />
                  </span>
                  <span className="text-[13.5px] leading-snug text-[#e4dfd0]">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative mt-10 hidden text-xs leading-relaxed text-[#8f8a76] lg:block">
            Rejected once? You can review the note and resubmit as many times as you need.
          </p>
        </aside>

        {/* Right — the actual form, styled to match the rest of BizNest's
            admin surfaces (white bg, standard tokens) rather than the rail's
            palette, so it reads as a normal part of the product. */}
        <div className="min-w-0 flex-1 px-5 py-8 sm:px-10 sm:py-12">
          <BusinessVerificationForm
            existingRejection={existing?.verificationStatus === "REJECTED" ? existing.rejectionReason : null}
          />
        </div>
      </div>
    </div>
  );
}
