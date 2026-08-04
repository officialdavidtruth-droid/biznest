import Link from "next/link";
import { FRAUD_POLICY_TEXT } from "@/lib/constants/fraud-policy";

export const metadata = { title: "Seller Agreement — BizNest" };

export default function SellerAgreementPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to BizNest</Link>
      <h1 className="mb-2 mt-4 text-3xl font-bold">Seller Agreement</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
        <strong>Before you launch:</strong> this is a starting draft, not legal advice — have it
        reviewed alongside the Terms of Service before opening BizNest to real sellers.
      </div>

      <Section title="1. Eligibility">
        You must complete business verification (registered business documentation, or government
        ID, selfie, and two guarantors) and be approved by BizNest before opening a store.
      </Section>

      <Section title="2. Fraud policy">
        By opening a store, you certify and agree to the following, which you also accept
        explicitly during store setup:
      </Section>
      <div className="ml-4 mt-2 whitespace-pre-line rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        {FRAUD_POLICY_TEXT}
      </div>

      <Section title="3. Commission and fees">
        BizNest charges a commission on completed orders, at the rate disclosed for your current
        subscription tier (visible in your dashboard under Subscription). Commission rates may
        change with notice; continued use of your store after a rate change takes effect
        constitutes acceptance.
      </Section>

      <Section title="4. Listing standards">
        Listings must accurately describe the product or service offered, including price,
        condition, and delivery/fulfillment expectations. Prohibited items include counterfeit
        goods, stolen goods, weapons, illegal substances, and anything violating applicable law.
        BizNest may remove listings that violate these standards without prior notice.
      </Section>

      <Section title="5. Order fulfillment">
        Sellers are responsible for fulfilling orders as described, within any timeframe stated in
        the listing, and for responding to buyer messages and disputes in good faith.
      </Section>

      <Section title="6. Payments and payouts">
        Payments are received directly into the Paystack or Flutterwave account you connect to
        your store. BizNest does not hold seller funds. You are responsible for your own tax
        obligations on income earned through BizNest.
      </Section>

      <Section title="7. Reviews and disputes">
        Sellers may respond publicly to customer reviews and must participate in good faith in any
        dispute raised against an order, including providing evidence when requested by BizNest
        staff.
      </Section>

      <Section title="8. Suspension and termination">
        BizNest may suspend or close your store for violations of this agreement, the Terms of
        Service, the Fraud Policy, or applicable law, including retaining evidence and cooperating
        with law enforcement where legally required.
      </Section>

      <Section title="9. Changes to this agreement">
        BizNest may update this agreement from time to time. Continued operation of your store
        after changes take effect constitutes acceptance.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
