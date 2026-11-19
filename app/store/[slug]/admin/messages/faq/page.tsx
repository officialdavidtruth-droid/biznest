// Route: /store/[slug]/admin/messages/faq
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getMessagingConfig } from "@/lib/actions/store-chat";
import { FaqEditor } from "@/components/dashboard/faq-editor";

export default async function FaqSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getMessagingConfig(slug);
  if (!data) {
    return <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">You don&apos;t have access to customer messages.</div>;
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/store/${slug}/admin/messages`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Messages
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Auto-replies &amp; FAQs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        These quick questions appear in your customers&apos; chat. When a customer taps one (or types something similar), they get the answer instantly and the chat is filed under its topic.
      </p>
      <FaqEditor slug={slug} initial={data.config} businessType={data.businessType} customized={data.customized} />
    </div>
  );
}
