import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/cart-context";

export const metadata: Metadata = {
  title: "BizNest — Build, Sell, Grow",
  description: "The all-in-one marketplace and website builder for products, services, and bookings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <CartProvider>
          {children}
          <Toaster richColors position="top-center" />
        </CartProvider>
      </body>
    </html>
  );
}
