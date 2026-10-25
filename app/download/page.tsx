import type { Metadata } from "next";
import { DownloadClient } from "./download-client";

export const metadata: Metadata = {
  title: "Get the BizNest app",
  description: "Download BizNest for Android, or install it on your phone or computer.",
  alternates: { canonical: "/download" },
};

// Where the Android APK lives. Default: public/downloads/biznest.apk served by
// this site. Set NEXT_PUBLIC_ANDROID_APK_URL to point at a GitHub Release or
// any other host instead.
const APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL || "/downloads/biznest.apk";

export default function DownloadPage() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-4 py-10">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <img src="/icon-192.png" alt="BizNest" width={72} height={72} className="mx-auto mb-4 rounded-2xl" />
        <h1 className="text-2xl font-bold text-gray-900">Get the BizNest app</h1>
        <p className="mt-2 text-sm text-gray-600">
          Run your store, orders, bookings and customers from your phone or computer.
        </p>
      </div>
      <DownloadClient apkUrl={APK_URL} />
    </main>
  );
}
