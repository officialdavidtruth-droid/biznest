import { redirect } from "next/navigation";
import { performUnsubscribe } from "@/lib/email/perform-unsubscribe";
import { decodeUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { readableOn } from "@/lib/storefront/readable-design";
import { prisma } from "@/lib/prisma";
import { StoreNotice, pickStoreColor, type NoticeStore } from "@/components/auth/store-notice";

async function storeBy(where: { id: string } | { slug: string }): Promise<NoticeStore> {
  const st = await prisma.store.findUnique({ where, select: { name: true, slug: true, logoUrl: true, themeColors: true } });
  return st ? { name: st.name, slug: st.slug, logoUrl: st.logoUrl, color: pickStoreColor(st.themeColors) } : null;
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string; s?: string }> }) {
  const { token, done, s } = await searchParams;

  // Unsubscribing is a state change, so it must never happen as a side
  // effect of a GET request (link scanners / previews fetch URLs without a
  // click). The page only *shows* a confirmation; the POST-only server
  // action wired to the button performs the mutation.
  if (done === "1") {
    const store = s ? await storeBy({ slug: s }) : null;
    const who = store?.name ?? "this store";
    return (
      <StoreNotice
        store={store}
        title="You’re unsubscribed"
        body={`You will no longer receive marketing emails from ${who}. You can subscribe again from their website at any time.`}
      />
    );
  }

  if (!token) {
    return <StoreNotice store={null} tone="warn" title="That link is not valid" body="This unsubscribe link may have expired or is incomplete." />;
  }

  const decoded = decodeUnsubscribeToken(token);
  const store = decoded ? await storeBy({ id: decoded.storeId }) : null;
  const who = store?.name ?? "this store";
  const color = store?.color ?? "#1f2937";

  return (
    <StoreNotice
      store={store}
      tone="mail"
      title={`Unsubscribe from ${who} emails?`}
      body={`You’ll stop receiving marketing emails from ${who}. You can subscribe again any time from their website.`}
    >
      <form
        action={async (formData: FormData) => {
          "use server";
          const t = String(formData.get("token") ?? "");
          await performUnsubscribe(t);
          const d = decodeUnsubscribeToken(t);
          const st = d ? await prisma.store.findUnique({ where: { id: d.storeId }, select: { slug: true } }) : null;
          redirect(st ? `/unsubscribe?done=1&s=${encodeURIComponent(st.slug)}` : `/unsubscribe?done=1`);
        }}
        className="mt-6"
      >
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold" style={{ background: color, color: readableOn(color) }}>
          Confirm unsubscribe
        </button>
      </form>
    </StoreNotice>
  );
}
