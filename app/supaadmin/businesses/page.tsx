import Link from "next/link";
import { listBusinesses } from "@/lib/actions/admin";
import type { VerificationStatus } from "@prisma/client";

const TABS: { label: string; value: VerificationStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "All", value: "ALL" },
];

export default async function BusinessesReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeTab: VerificationStatus | "ALL" = (status as VerificationStatus | "ALL" | undefined) ?? "PENDING";
  const businesses = await listBusinesses(activeTab === "ALL" ? undefined : activeTab);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Business verification</h1>

      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "ALL" ? "/supaadmin/businesses?status=ALL" : `/supaadmin/businesses?status=${t.value}`}
            className={`px-3 py-2 text-sm ${
              activeTab === t.value
                ? "border-b-2 border-primary font-medium text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Business</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Path</th>
              <th className="px-4 py-2">Submitted</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{b.businessName}</td>
                <td className="px-4 py-3 text-muted-foreground">{b.user.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {b.registrationType === "REGISTERED" ? "Registered" : "Unregistered + guarantors"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(b.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.verificationStatus} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/supaadmin/businesses/${b.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  const styles: Record<VerificationStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    SUSPENDED: "bg-gray-200 text-gray-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>{status}</span>;
}
