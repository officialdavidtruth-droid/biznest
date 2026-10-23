"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

/**
 * Floating "chat with us" button on the public storefront. It opens a WhatsApp
 * chat with the vendor's OWN number (set in Settings) -- never the platform's.
 * Hidden on dashboard pages, which share the storefront layout.
 */
export function WhatsAppChatButton({ href, storeName }: { href: string; storeName: string }) {
  const pathname = usePathname() ?? "";
  if (pathname.includes("/admin")) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${storeName} on WhatsApp`}
      style={{
        position: "fixed", right: 20, bottom: 20, zIndex: 40, width: 52, height: 52, borderRadius: 999,
        background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 20px rgba(0,0,0,.25)",
      }}
    >
      <MessageCircle size={26} />
    </a>
  );
}
