import type { Metadata } from "next";

export const metadata: Metadata = { title: "Domain not connected", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function DomainNotConnectedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">This domain isn’t connected to a store yet</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        If you own this domain, open your store’s Settings → Custom domain and check that it shows VERIFIED. Changes can take a few minutes to start working.
      </p>
    </main>
  );
}
