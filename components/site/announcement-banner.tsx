"use client";

import { useState } from "react";
import { X } from "lucide-react";

const TONE_STYLES = {
  info: "bg-blue-600 text-white",
  warning: "bg-amber-500 text-black",
  success: "bg-green-600 text-white",
};

export function AnnouncementBanner({
  message,
  tone,
}: {
  message: string;
  tone: "info" | "warning" | "success";
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !message) return null;

  return (
    <div className={`relative flex items-center justify-center gap-3 px-10 py-2 text-center text-sm font-medium ${TONE_STYLES[tone]}`}>
      <span>{message}</span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="absolute right-3 rounded-full p-1 hover:bg-black/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
