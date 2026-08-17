import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
        title="Missing verification link"
        body="This link is missing its token. Please use the link from your verification email."
      />
    );
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.type !== "EMAIL") {
    return (
      <Message
        title="Invalid verification link"
        body="This link is invalid. It may have already been used — if your email is already verified, you can just sign in."
        cta
      />
    );
  }

  if (record.expires < new Date()) {
    // One-time use, so a stale/expired token is deleted here too rather
    // than left to linger in the table.
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    return (
      <Message
        title="Link expired"
        body="This verification link has expired. Sign in and we'll send you a fresh one."
        cta
      />
    );
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  return (
    <Message
      title="Email verified"
      body="Your email address has been confirmed. You're all set — sign in to continue."
      cta
    />
  );
}

function Message({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {cta && (
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          Go to sign in
        </Link>
      )}
    </div>
  );
}
