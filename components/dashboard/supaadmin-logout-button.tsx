"use client";

import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";

export function SupaAdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.href = "/supaadmin/login";
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
      style={{ color: "hsl(0 84% 70%)" }}
    >
      {loading ? <RefreshCw size={14} className="animate-spin" /> : <LogOut size={14} />}
      Sign out
    </button>
  );
}
