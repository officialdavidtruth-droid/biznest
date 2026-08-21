import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AcceptInviteButton } from "@/components/dashboard/accept-invite-button";
import { labelForPermission } from "@/lib/access/staff-permissions";

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

  if (!invite.invitedEmail) {
    return (
      <InviteMessage
        title="This invite link is outdated"
        body="This invite was created before staff accounts got login credentials directly. Ask the store owner to remove and re-invite you."
      />
    );
  }

  const callbackUrl = `/staff/accept?token=${token}`;

  // Whether the invited email already has a BizNest account. Used both when
  // nobody is signed in yet, and when someone is signed in with a different
  // email — in both cases an unregistered invited email needs a path to
  // *create* an account, not just a dead-end "sign in with that email"
  // message with nowhere to go.
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: invite.invitedEmail, mode: "insensitive" } },
    select: { id: true },
  });

  const session = await auth();
  const emailMatches = session?.user?.email?.toLowerCase() === invite.invitedEmail.toLowerCase();

  // No session, or signed in as someone else, and the invited email has no
  // account yet: send straight to signup instead of showing an
  // "existing user" style message. There's no other account to reveal or
  // compare against in this case, so there's nothing to gain by mentioning
  // whichever email happens to be signed in right now — it just needs to
  // become a create-account prompt.
  if ((!session?.user?.id || !emailMatches) && !existingUser) {
    redirect(`/register?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invite.invitedEmail)}`);
  }

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invite.invitedEmail)}`);
  }
  const roleLabel = invite.role === "MANAGER" ? "Manager" : "Staff member";

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Join {invite.store.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {invite.invitedName ? `${invite.invitedName}, y` : "Y"}ou've been invited
        {invite.position ? ` as ${invite.position} (${roleLabel})` : ` as a ${roleLabel}`}.
      </p>

      {invite.permissions.length > 0 && (
        <div className="mt-4 rounded-lg border border-border p-4 text-left">
          <p className="text-xs font-medium text-muted-foreground">You'll have access to:</p>
          <ul className="mt-2 space-y-1 text-sm">
            {invite.permissions.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                {labelForPermission(p)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!emailMatches ? (
        // By this point existingUser must be true — the no-account case
        // already redirected to /register above.
        <div className="mt-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
          <p>
            This invite was sent to <strong>{invite.invitedEmail}</strong>, but you're signed in with a different
            account.
          </p>
          <form
            className="mt-4"
            action={async () => {
              "use server";
              // Actually sign the current account out instead of just
              // telling the person to do it manually — lands them on
              // /login pre-filled with the invited email so they can go
              // straight into that account and come right back here.
              await signOut({
                redirectTo: `/login?callbackUrl=${encodeURIComponent(callbackUrl)}&email=${encodeURIComponent(invite.invitedEmail)}`,
              });
            }}
          >
            <button
              type="submit"
              className="inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Sign out &amp; continue as {invite.invitedEmail}
            </button>
          </form>
        </div>
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
