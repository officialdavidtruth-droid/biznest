import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-semibold">BizNest</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Build your store. Sell products, services, and bookings — all in one place.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          BizNest gives you a storefront, an admin dashboard, and secure payments, without
          writing a line of code.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/register"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Start selling
          </Link>
          <Link href="/login" className="rounded-md border px-6 py-3 text-sm font-medium">
            Sign in
          </Link>
        </div>
      </main>

      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BizNest. All rights reserved.
      </footer>
    </div>
  );
}