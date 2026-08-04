import Link from "next/link";

export const metadata = { title: "Terms of Service — BizNest" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to BizNest</Link>
      <h1 className="mb-2 mt-4 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
        <strong>Before you launch:</strong> this is a starting draft covering the standard terms a
        marketplace needs. It is not legal advice. Have a licensed attorney in your operating
        jurisdiction (Nigeria, given BizNest's base) review and adapt this before opening the
        platform to real users — especially the sections on liability, dispute resolution, and
        data protection (NDPR compliance).
      </div>

      <Section title="1. Acceptance of terms">
        By creating an account, opening a store, or making a purchase on BizNest, you agree to
        these Terms of Service, the Privacy Policy, and — if you are a seller — the Seller
        Agreement and Fraud Policy presented during store setup. If you do not agree, do not use
        BizNest.
      </Section>

      <Section title="2. Who can use BizNest">
        You must be at least 18 years old, or the age of majority in your jurisdiction, to create
        an account. By registering, you confirm the information you provide is accurate and that
        you have the authority to act on behalf of any business you register.
      </Section>

      <Section title="3. Accounts and roles">
        BizNest supports customer, store owner, and platform staff accounts. You are responsible
        for maintaining the confidentiality of your login credentials and for all activity under
        your account. Notify us immediately of any unauthorized use.
      </Section>

      <Section title="4. Seller obligations and verification">
        Store owners must complete business verification (registered business documentation, or
        government ID, selfie, and guarantor details) before opening a store, and must accept the
        Fraud Policy. BizNest may approve, reject, or suspend any store or business account at its
        discretion, including for suspected fraud, misrepresentation, or policy violations.
      </Section>

      <Section title="5. Products, services, and listings">
        Sellers are solely responsible for the accuracy of their listings, the legality of items
        or services offered, and fulfillment of orders. BizNest does not manufacture, own, or take
        title to any goods sold through the platform and is not a party to the transaction between
        buyer and seller.
      </Section>

      <Section title="6. Payments">
        Payments are processed through third-party providers (Paystack, Flutterwave) connected
        directly to each seller's own account. BizNest does not store payment card details and is
        not responsible for outages, delays, or errors caused by these third-party providers.
        Platform commission rates are disclosed in your subscription plan.
      </Section>

      <Section title="7. Buyer protection and disputes">
        BizNest provides an order and dispute system to help resolve issues between buyers and
        sellers, including evidence submission and administrator review. Resolution decisions are
        made at BizNest's reasonable discretion and are not a guarantee of refund or replacement in
        every case.
      </Section>

      <Section title="8. Prohibited conduct">
        You may not use BizNest to: sell counterfeit, stolen, or illegal goods; engage in fraud,
        money laundering, or identity theft; harass or discriminate against other users; upload
        malicious code; or circumvent platform fees. Violations may result in suspension,
        termination, evidence retention, and cooperation with law enforcement where legally
        required.
      </Section>

      <Section title="9. Intellectual property">
        BizNest and its licensors retain all rights to the platform itself. Sellers retain
        ownership of their own content (listings, images, store branding) but grant BizNest a
        license to display it as necessary to operate the marketplace.
      </Section>

      <Section title="10. Limitation of liability">
        BizNest is provided "as is." To the fullest extent permitted by law, BizNest is not liable
        for indirect, incidental, or consequential damages arising from use of the platform,
        transactions between users, or third-party payment provider issues.
      </Section>

      <Section title="11. Termination">
        BizNest may suspend or terminate any account for violation of these terms, the Fraud
        Policy, or applicable law. You may close your account at any time; certain records may be
        retained as required by law or for legitimate business purposes.
      </Section>

      <Section title="12. Governing law">
        These terms are governed by the laws of the Federal Republic of Nigeria, without regard to
        conflict-of-law principles, unless otherwise required by applicable local law where you
        reside.
      </Section>

      <Section title="13. Changes to these terms">
        BizNest may update these terms from time to time. Continued use of the platform after
        changes take effect constitutes acceptance of the revised terms.
      </Section>

      <Section title="14. Contact">
        Questions about these terms can be sent to the support contact listed on your BizNest
        dashboard.
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
