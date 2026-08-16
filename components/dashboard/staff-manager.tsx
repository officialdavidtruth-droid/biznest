"use client";

import { useState } from "react";
import { toast } from "sonner";
import { inviteStaffMember, revokeStaffMember } from "@/lib/actions/staff";

type Member = { id: string; email: string; role: string; status: string; invitedAt: Date; name: string | null };

export function StaffManager({ slug, initialMembers }: { slug: string; initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MANAGER" | "STAFF">("STAFF");
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    const { listStaffMembers } = await import("@/lib/actions/staff");
    const result = await listStaffMembers(slug);
    if (result.success) setMembers(result.data);
  }

  async function handleInvite() {
    if (!email.trim()) return;
    setInviting(true);
    const result = await inviteStaffMember(slug, email.trim(), role);
    setInviting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Invite sent to ${email.trim()}`);
    setEmail("");
    await refresh();
  }

  async function handleRevoke(id: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail}'s access?`)) return;
    const result = await revokeStaffMember(slug, id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Access removed.");
    await refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground">Email address</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@example.com"
            className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "MANAGER" | "STAFF")}
            className="mt-1 w-full rounded border border-border bg-background p-2 text-sm sm:w-auto"
          >
            <option value="STAFF">Staff</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
        <button
          onClick={handleInvite}
          disabled={inviting || !email.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {inviting ? "Sending…" : "Send invite"}
        </button>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Team ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff invited yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name ?? m.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email} · {m.role === "MANAGER" ? "Manager" : "Staff"} ·{" "}
                    <span
                      className={
                        m.status === "ACTIVE"
                          ? "text-emerald-500"
                          : m.status === "PENDING"
                            ? "text-amber-500"
                            : "text-muted-foreground"
                      }
                    >
                      {m.status === "ACTIVE" ? "Active" : m.status === "PENDING" ? "Invite pending" : "Revoked"}
                    </span>
                  </p>
                </div>
                {m.status !== "REVOKED" && (
                  <button
                    onClick={() => handleRevoke(m.id, m.email)}
                    className="shrink-0 text-xs font-medium text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
