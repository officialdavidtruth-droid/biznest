export default function SupportPage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-semibold">Support</h1>
      <div className="rounded-lg border bg-background p-5">
        <p className="text-sm">Need help with your store, a payout, or a dispute?</p>
        <a href="mailto:support@biznest.ng" className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Email support@biznest.ng
        </a>
      </div>
      <div className="mt-4 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        In-app ticketing is on the roadmap. For now every request is handled by email and tracked manually.
      </div>
    </div>
  );
}
