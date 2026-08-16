import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AcceptInviteButton } from "@/components/dashboard/accept-invite-button";

export default async function AcceptStaffInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/");

  const invite = await prisma.storeStaff.findUnique({ where: { inviteToken: token }, include: { store: true } });

  if (!invite || invite.status === "REVOKED") {
    return <InviteMessage title="Invite not found" body="This invite link is invalid or has been revoked." />;
  }
  if (invite.status === "ACTIVE") {
    return <InviteMessage title="Already accepted" body="This invite has already been used." />;
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/staff/accept?token=${token}`)}`);
  }

  const emailMatches = session.user.email?.toLowerCase() === invite.invitedEmail.toLowerCase();

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Join {invite.store.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You've been invited as a <strong>{invite.role === "MANAGER" ? "Manager" : "Staff member"}</strong>.
      </p>
      {!emailMatches ? (
        <p className="mt-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
          This invite was sent to <strong>{invite.invitedEmail}</strong>, but you're signed in as{" "}
          <strong>{session.user.email}</strong>. Sign out and sign in with the invited email to accept.
        </p>
      ) : (
        <AcceptInviteButton token={token} />
      )}
    </div>
  );
}

function InviteMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
