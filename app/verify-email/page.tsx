import { prisma } from "@/lib/prisma";
import { ensureAccountProfile } from "@/lib/customer-profile-store";
import { reconcileReferralsForReferee } from "@/lib/payments/referral-award";
import { ResendVerification } from "@/components/forms/resend-verification";
import { StoreNotice, StoreButtonLink, pickStoreColor, type NoticeStore } from "@/components/auth/store-notice";

async function storeForUser(userId: string): Promise<NoticeStore> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { customerScopeStoreId: true } });
  if (!u?.customerScopeStoreId) return null;
  const st = await prisma.store.findUnique({
    where: { id: u.customerScopeStoreId },
    select: { name: true, slug: true, logoUrl: true, themeColors: true },
  });
  return st ? { name: st.name, slug: st.slug, logoUrl: st.logoUrl, color: pickStoreColor(st.themeColors) } : null;
}

/**
 * Consumes the token from sendVerificationEmail (lib/email/send.ts). This
 * route previously didn't exist at all — the email linked to it, but
 * nothing handled the token, and "verify-email" wasn't a reserved slug
 * either, so requests fell through to the /store/[slug] rewrite in
 * middleware.ts and 404'd as "Store not found". See reserved-slugs.ts.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Message
        store={null}
        title="Missing verification link"
        body="This link is missing its token. Please use the link from your verification email."
      />
    );
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.type !== "EMAIL") {
    return (
      <Message
        store={null}
        title="Invalid verification link"
        body="This link is invalid. It may have already been used — if your email is already verified, you can just sign in. Otherwise, request a new link below."
        cta
        resend={{}}
      />
    );
  }

  const store = await storeForUser(record.identifier);

  if (record.expires < new Date()) {
    // Look the account up first so the resend control below can be pre-filled
    // and sent to the right account (a store customer vs. a platform account).
    const owner = await prisma.user.findUnique({
      where: { id: record.identifier },
      select: { email: true, customerScopeStoreId: true },
    });
    const ownerStore = owner?.customerScopeStoreId
      ? await prisma.store.findUnique({ where: { id: owner.customerScopeStoreId }, select: { slug: true } })
      : null;
    // One-time use, so a stale/expired token is deleted here too rather
    // than left to linger in the table.
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    return (
      <Message
        store={store}
        title="Link expired"
        body="This verification link has expired. Request a new one below."
        resend={{ email: owner?.email, storeSlug: ownerStore?.slug }}
      />
    );
  }

  // identifier is the account's own id (see registerUser in
  // lib/actions/auth.ts) -- not email, since the same email can now
  // belong to several independent accounts (one per store).
  await prisma.user.update({
    where: { id: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
  // A referral reward may have been waiting on this verification.
  await reconcileReferralsForReferee(record.identifier);
  // Now that the address is proven, a store customer can be linked to the profile the store already
  // holds for it (e.g. from a POS sale). Signup deliberately did not do this while it was unverified.
  const verified = await prisma.user.findUnique({ where: { id: record.identifier }, select: { name: true, email: true, role: true, customerScopeStoreId: true } });
  if (verified?.role === "CUSTOMER" && verified.customerScopeStoreId) {
    await ensureAccountProfile(prisma, { storeId: verified.customerScopeStoreId, userId: record.identifier, name: verified.name || verified.email, email: verified.email, emailVerified: true }).catch(() => {});
  }

  return (
    <Message
      store={store}
      title="Email verified"
      body="Your email address has been confirmed. You're all set — sign in to continue."
      cta
    />
  );
}

function Message({
  store,
  title,
  body,
  cta,
  resend,
}: {
  store: NoticeStore;
  title: string;
  body: string;
  cta?: boolean;
  resend?: { email?: string | null; storeSlug?: string | null };
}) {
  return (
    <StoreNotice store={store} title={title} body={body} tone={cta ? "ok" : "warn"}>
      {resend && (
        <div className="mt-6 w-full text-left">
          <ResendVerification defaultEmail={resend.email ?? undefined} storeSlug={resend.storeSlug ?? undefined} heading="Send me a new verification link" />
        </div>
      )}
      {cta && (
        <StoreButtonLink href={store ? `/login?store=${encodeURIComponent(store.slug)}` : "/login"} color={store?.color ?? null}>
          Go to sign in
        </StoreButtonLink>
      )}
    </StoreNotice>
  );
}
