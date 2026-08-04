import Link from "next/link";

export const metadata = { title: "Privacy Policy — BizNest" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to BizNest</Link>
      <h1 className="mb-2 mt-4 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
        <strong>Before you launch:</strong> this is a starting draft, not legal advice. BizNest
        collects sensitive identity documents (government IDs, selfies, guarantor details) as part
        of KYC verification — have this reviewed by a lawyer for compliance with Nigeria's Data
        Protection Act (NDPA) and any other jurisdiction your users are in before going live.
      </div>

      <Section title="1. What we collect">
        Account information (name, email, phone); business verification documents (registration
        certificate, or government ID, selfie, and guarantor details); store and listing content
        you create; order and transaction records; messages sent through the platform; and usage
        data such as device and log information.
      </Section>

      <Section title="2. Why we collect it">
        To operate your account and store, verify seller identity and reduce fraud, process and
        display orders, facilitate buyer-seller communication, enforce our Terms of Service and
        Fraud Policy, and improve the platform.
      </Section>

      <Section title="3. Identity verification documents">
        Government IDs, selfies, and guarantor information are used solely to verify seller
        identity and are visible only to you and BizNest platform staff reviewing your
        application. We do not sell or share this information with third parties except as
        required by law or to cooperate with law enforcement in confirmed fraud cases, as described
        in the Fraud Policy you accept when opening a store.
      </Section>

      <Section title="4. Payments">
        BizNest does not process or store your payment card details. Payments are handled directly
        by Paystack and/or Flutterwave under their own privacy policies. We store transaction
        metadata (amount, status, order reference) needed to display your order history.
      </Section>

      <Section title="5. File storage">
        Uploaded images and documents are stored via Cloudinary. Verification documents are kept in
        access-controlled storage separate from public store images.
      </Section>

      <Section title="6. Sharing">
        We share information with: the payment providers you connect your store to; Resend, for
        transactional email delivery; Cloudinary, for file storage; and law enforcement or
        regulators where legally required. We do not sell personal data to advertisers.
      </Section>

      <Section title="7. Data retention">
        We retain account and transaction data for as long as your account is active and as
        needed to comply with legal, tax, and dispute-resolution obligations. Rejected verification
        submissions may be retained for a limited period to prevent repeat fraudulent applications.
      </Section>

      <Section title="8. Your rights">
        Depending on your jurisdiction, you may have the right to access, correct, or request
        deletion of your personal data, subject to our legal retention obligations. Contact support
        through your dashboard to make a request.
      </Section>

      <Section title="9. Cookies">
        BizNest uses cookies necessary for authentication (keeping you signed in) and basic site
        functionality. We do not currently use third-party advertising cookies.
      </Section>

      <Section title="10. Children">
        BizNest is not directed at individuals under 18. We do not knowingly collect data from
        minors.
      </Section>

      <Section title="11. Changes to this policy">
        We may update this policy from time to time. Material changes will be communicated via
        email or in-app notice where required.
      </Section>

      <Section title="12. Contact">
        Questions about this policy or your data can be sent to the support contact listed on your
        BizNest dashboard.
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
