"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions/notifications";

type NotificationItem = {
  id: string;
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

/**
 * Renders on every dashboard page (mobile top bar + desktop sidebar
 * header). Notifications are passed in from the server layout on initial
 * load, not fetched client-side — this stays a bell that opens instantly on
 * a slow connection instead of a spinner. Read-state syncs on open.
 */
export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unreadCount);
  const [, startTransition] = useTransition();

  useEffect(() => setCount(unreadCount), [unreadCount]);

  function handleOpen() {
    setOpen((o) => !o);
    if (!open && count > 0) {
      setCount(0);
      startTransition(() => {
        void markNotificationsRead();
      });
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 max-h-[70vh] w-[calc(100vw-24px)] max-w-sm overflow-y-auto rounded-xl border border-border bg-background shadow-lg sm:w-80">
            <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">Notifications</p>
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div className="border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                  </div>
                );
                return n.url ? (
                  <Link key={n.id} href={n.url} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
