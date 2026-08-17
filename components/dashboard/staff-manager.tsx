"use client";

import { useState } from "react";
import { toast } from "sonner";
import { inviteStaffMember, revokeStaffMember } from "@/lib/actions/staff";
import { STAFF_PERMISSIONS, labelForPermission } from "@/lib/access/staff-permissions";

type Member = {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedAt: Date;
  name: string | null;
  position: string | null;
  permissions: string[];
};

export function StaffManager({ slug, initialMembers }: { slug: string; initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MANAGER" | "STAFF">("STAFF");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    const { listStaffMembers } = await import("@/lib/actions/staff");
    const result = await listStaffMembers(slug);
    if (result.success) setMembers(result.data);
  }

  function togglePermission(id: string) {
    setPermissions((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleInvite() {
    if (!name.trim() || !position.trim() || !email.trim() || permissions.length === 0) return;
    setInviting(true);
    const result = await inviteStaffMember(slug, email.trim(), role, name.trim(), position.trim(), permissions);
    setInviting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Invite sent to ${email.trim()}`);
    setName("");
    setPosition("");
    setEmail("");
    setPermissions([]);
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

  const canSubmit = name.trim() && position.trim() && email.trim() && permissions.length > 0 && !inviting;

  return (
    <div className="mt-6 space-y-6">
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Staff member's name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amaka Obi"
              className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Position</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Store Manager, Cashier"
              className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@example.com"
              className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Access level</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "MANAGER" | "STAFF")}
              className="mt-1 w-full rounded border border-border bg-background p-2 text-sm sm:w-auto"
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            What can they access? <span className="text-destructive">*</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAFF_PERMISSIONS.map((perm) => (
              <label
                key={perm.id}
                className="flex cursor-pointer items-center gap-2 rounded border border-border p-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={permissions.includes(perm.id)}
                  onChange={() => togglePermission(perm.id)}
                  className="h-3.5 w-3.5"
                />
                {perm.label}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleInvite}
          disabled={!canSubmit}
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
                  <p className="truncate font-medium">
                    {m.name ?? m.email}
                    {m.position ? <span className="font-normal text-muted-foreground"> · {m.position}</span> : null}
                  </p>
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
                  {m.permissions.length > 0 && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Access: {m.permissions.map(labelForPermission).join(", ")}
                    </p>
                  )}
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
