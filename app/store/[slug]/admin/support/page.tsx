import { SupportChat } from "@/components/app/support-chat";

// Route: /store/[slug]/admin/support
export default function SupportPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Support</h1>
      <p className="mb-5 text-sm text-muted-foreground">Ask the assistant anything about your dashboard. For payouts, disputes or account problems, it will hand you to the team.</p>
      <SupportChat />
      <div className="mt-4 rounded-lg border bg-background p-4 text-sm">
        Prefer email? <a href="mailto:biznestsupport@gmail.com" className="font-medium text-primary underline">biznestsupport@gmail.com</a>
      </div>
    </div>
  );
}
