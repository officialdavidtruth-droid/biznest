"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, CreditCard, ShoppingCart, MessageSquare, ShieldCheck, Zap, X } from "lucide-react";
import { markNotificationRead, markNotificationsRead } from "@/lib/actions/notifications";

type NotificationItem = {
  id: string;
  type?: string;
  title: string;
  body: string;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function iconFor(type?: string) {
  if (type === "ABANDONED_CHECKOUT") return { Icon: ShoppingCart, tone: "bg-amber-100 text-amber-700" };
  if (type === "ORDER_PAID") return { Icon: CreditCard, tone: "bg-emerald-100 text-emerald-700" };
  if (type === "MESSAGE") return { Icon: MessageSquare, tone: "bg-sky-100 text-sky-700" };
  if (type === "VERIFICATION") return { Icon: ShieldCheck, tone: "bg-violet-100 text-violet-700" };
  if (type?.startsWith("SUBSCRIPTION")) return { Icon: CreditCard, tone: "bg-rose-100 text-rose-700" };
  return { Icon: Zap, tone: "bg-muted text-muted-foreground" };
}

/**
 * Renders on every dashboard page (mobile top bar + desktop header).
 * Notifications come from the server layout on initial load so the bell
 * opens instantly. The panel is portaled to <body> and positioned `fixed`
 * so no sticky header / sidebar stacking context can clip or overlap it.
 * Items are marked read individually when tapped, or all at once.
 */
export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [allRead, setAllRead] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setReadIds(new Set());
    setAllRead(false);
  }, [notifications]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isUnread = (n: NotificationItem) => !allRead && !n.readAt && !readIds.has(n.id);
  const count = allRead ? 0 : Math.max(0, unreadCount - readIds.size);

  function openItem(n: NotificationItem) {
    if (isUnread(n)) {
      setReadIds((s) => new Set(s).add(n.id));
      startTransition(() => void markNotificationRead(n.id));
    }
    setOpen(false);
    if (n.url) router.push(n.url);
  }

  function markAll() {
    setAllRead(true);
    startTransition(() => void markNotificationsRead());
  }

  const panel = (
    <>
      <div className="fixed inset-0 z-[90] bg-black/20 sm:bg-transparent" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-label="Notifications"
        className="fixed inset-x-3 top-16 z-[100] flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[26rem]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-1">
            {count > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain">
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const unread = isUnread(n);
                const { Icon, tone } = iconFor(n.type);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/60 ${unread ? "bg-primary/5" : ""}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-sm leading-snug ${unread ? "font-semibold" : "font-medium"}`}>{n.title}</span>
                          {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
