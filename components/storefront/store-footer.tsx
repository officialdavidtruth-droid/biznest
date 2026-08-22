import Link from "next/link";

// Every template's *-chrome.tsx wraps its own themed footer around
// home/product/cart/checkout pages. This is for the generic, non-template
// pages under /store/[slug] (orders, account) that don't go through any
// template chrome and were rendering with no footer at all.
export function StoreFooter({ storeName, slug }: { storeName: string; slug: string }) {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white px-6 py-8 text-center text-xs text-slate-400">
      <p>
        &copy; {new Date().getFullYear()} {storeName}. Powered by{" "}
        <Link href="/" className="font-medium text-slate-500 hover:underline">
          BizNest
        </Link>
        .
      </p>
      <p className="mt-1">
        <Link href={`/${slug}`} className="hover:underline">
          Back to store
        </Link>
      </p>
    </footer>
  );
}
