import { redirect } from "next/navigation";
import { performPlatformUnsubscribe } from "@/lib/email/perform-platform-unsubscribe";
import { decodePlatformUnsubscribeToken } from "@/lib/email/platform-unsubscribe";
import { StoreNotice } from "@/components/auth/store-notice";

export default async function PlatformUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;

  if (done === "1") {
    return (
      <StoreNotice
        store={null}
        title="You're unsubscribed"
        body="You won't get reminders or promotional emails from BizNest any more. You'll still receive account emails such as receipts, verification and security alerts."
      />
    );
  }

  if (!token || !decodePlatformUnsubscribeToken(token)) {
    return <StoreNotice store={null} tone="warn" title="That link is not valid" body="This unsubscribe link may have expired or is incomplete." />;
  }

  // Unsubscribing changes data, so a GET only shows the confirmation; the button performs the change.
  return (
    <StoreNotice
      store={null}
      tone="mail"
      title="Unsubscribe from BizNest emails?"
      body="You'll stop getting setup reminders and promotional emails from BizNest. Receipts, verification and security emails will continue."
    >
      <form
        action={async (formData: FormData) => {
          "use server";
          await performPlatformUnsubscribe(String(formData.get("token") ?? ""));
          redirect("/unsubscribe/platform?done=1");
        }}
        className="mt-6"
      >
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="w-full rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white">
          Unsubscribe
        </button>
      </form>
    </StoreNotice>
  );
}
