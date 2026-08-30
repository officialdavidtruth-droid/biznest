import { redirect } from "next/navigation";
import { performUnsubscribe } from "@/lib/email/perform-unsubscribe";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;

  // Unsubscribing is a state change, so it must never happen as a side
  // effect of a GET request — link scanners, email-security prefetchers
  // and chat/browser link previews all fetch URLs like this one without
  // the recipient ever clicking, which would otherwise silently
  // unsubscribe people who never asked to be. The page only *shows* a
  // confirmation; `confirmUnsubscribe` (a POST-only server action, wired
  // to the button below) is what actually performs the mutation.
  if (done === "1") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-background p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">✓</div>
          <h1 className="text-xl font-semibold">You’re unsubscribed</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">You will no longer receive marketing emails from this business. You can subscribe again from the business website at any time.</p>
          <p className="mt-6 text-xs text-muted-foreground">Powered by BizNest</p>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-background p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">!</div>
          <h1 className="text-xl font-semibold">That link is not valid</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">This unsubscribe link may have expired or is incomplete.</p>
          <p className="mt-6 text-xs text-muted-foreground">Powered by BizNest</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">✉</div>
        <h1 className="text-xl font-semibold">Unsubscribe from marketing emails?</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">You’ll stop receiving marketing emails from this business. You can subscribe again any time from their website.</p>
        <form
          action={async (formData: FormData) => {
            "use server";
            const t = String(formData.get("token") ?? "");
            await performUnsubscribe(t);
            redirect(`/unsubscribe?done=1`);
          }}
          className="mt-6"
        >
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Confirm unsubscribe
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">Powered by BizNest</p>
      </div>
    </main>
  );
}
