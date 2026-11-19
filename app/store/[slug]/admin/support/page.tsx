import { SupportChat } from "@/components/app/support-chat";
import { SUPPORT_EMAIL } from "@/lib/constants/support";

// Route: /store/[slug]/admin/support
export default async function SupportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Support</h1>
      <p className="mb-5 text-sm text-muted-foreground">Ask a question about your dashboard and get an instant answer. For payouts, disputes or account problems, one tap sends your chat to the team.</p>
      <SupportChat slug={slug} />
      <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-4 flex items-center justify-between gap-3 rounded-2xl border bg-background p-4 text-sm shadow-sm">
        <span className="text-muted-foreground">Prefer email?</span>
        <span className="truncate font-semibold text-primary">{SUPPORT_EMAIL}</span>
      </a>
    </div>
  );
}
