// Route: /store/[slug]/admin/verification
import { prisma } from "@/lib/prisma";

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-destructive/10 text-destructive",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
};

export default async function VerificationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { business: { include: { guarantors: true } } },
  });
  if (!store) return null;

  const b = store.business;

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold">Verification status</h1>

      <div className="mb-4 flex items-center justify-between rounded-lg border bg-background p-4">
        <div>
          <p className="font-medium">{b.businessName}</p>
          <p className="text-sm text-muted-foreground">{b.registrationType === "REGISTERED" ? "Registered business" : "Individual · ID + guarantors"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[b.verificationStatus] ?? "bg-muted"}`}>
          {b.verificationStatus.replace("_", " ")}
        </span>
      </div>

      {b.verificationStatus === "REJECTED" && b.rejectionReason && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Reason</p>
          <p className="mt-1">{b.rejectionReason}</p>
        </div>
      )}

      {b.registrationType === "UNREGISTERED" && (
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-2 text-sm font-medium">Guarantors ({b.guarantors.length})</p>
          <div className="space-y-2">
            {b.guarantors.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                <span>{g.fullName} <span className="text-muted-foreground">· {g.relationship}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Verification badge {b.verificationBadge ? "is showing" : "is not showing yet"} on your storefront.
      </p>
    </div>
  );
}
