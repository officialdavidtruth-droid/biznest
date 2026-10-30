import { SupportChat } from "@/components/app/support-chat";
import { SUPPORT_EMAIL } from "@/lib/constants/support";

// Route: /store/[slug]/admin/support
export default async function SupportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Support</h1>
      <p className="mb-5 text-sm text-muted-foreground">Ask a question about your dashboard and get an instant answer. For payouts, disputes or account problems, one tap sends your chat to the team.</p>
      <SupportChat slug={slug} />
      <div className="mt-4 rounded-lg border bg-background p-4 text-sm">
        Prefer email? <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline">{SUPPORT_EMAIL}</a>
      </div>
    </div>
  );
}
