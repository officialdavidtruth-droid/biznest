"use client";

import { useEffect } from "react";
import { markBrowseNotificationsRead } from "@/lib/actions/browse-notifications";

/** Clears the unread count once the list has been shown. */
export function MarkRead({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => { if (hasUnread) void markBrowseNotificationsRead(); }, [hasUnread]);
  return null;
}
