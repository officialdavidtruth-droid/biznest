import { getBusinessDetail } from "@/lib/actions/admin";
import { notFound } from "next/navigation";
import { BusinessReviewActions } from "@/components/dashboard/business-review-actions";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusinessDetail(businessId);
  if (!business) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{business.businessName}</h1>
          <p className="text-sm text-muted-foreground">
            Submitted by {business.user.name ?? business.user.email} ({business.user.email})
          </p>
        </div>
        <StatusPill status={business.verificationStatus} />
      </div>

      <Section title="Business details">
        <Grid>
          <Field label="Category" value={business.category} />
          <Field label="Phone" value={business.phone} />
          <Field label="Email" value={business.email} />
          <Field label="Location" value={`${business.city}, ${business.state}, ${business.country}`} />
          <Field label="Registration path" value={business.registrationType} />
          <Field label="Fraud policy accepted" value={business.fraudPolicyAcceptedAt ? "Yes" : "Not yet"} />
        </Grid>
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Description</p>
          <p className="text-sm">{business.description}</p>
        </div>
      </Section>

      <Section title="Documents">
        {business.registrationType === "REGISTERED" ? (
          <DocLink label="Business registration certificate" url={business.registrationCertUrl} />
        ) : (
          <div className="space-y-2">
            <DocLink label="Government-issued ID" url={business.governmentIdUrl} />
            <DocLink label="Selfie verification" url={business.selfieUrl} />
          </div>
        )}
      </Section>

      {business.guarantors.length > 0 && (
        <Section title="Guarantors">
          <div className="space-y-3">
            {business.guarantors.map((g) => (
              <div key={g.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{g.fullName} — {g.relationship}</p>
                <p className="text-muted-foreground">{g.phone} · {g.email}</p>
                <DocLink label="Government ID" url={g.governmentIdUrl} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {business.rejectionReason && (
        <Section title="Last review note">
          <p className="text-sm text-destructive">{business.rejectionReason}</p>
        </Section>
      )}

      <Section title="Decision">
        <BusinessReviewActions businessId={business.id} status={business.verificationStatus} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border bg-background p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return <p className="text-sm text-muted-foreground">{label}: not provided</p>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block text-sm text-primary hover:underline"
    >
      {label} ↗
    </a>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    SUSPENDED: "bg-gray-200 text-gray-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}>{status}</span>;
}
