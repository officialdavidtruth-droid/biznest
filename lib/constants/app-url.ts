// Single source of truth for the platform's base URL. Several files each
// used to hardcode their own fallback for when NEXT_PUBLIC_APP_URL isn't
// set -- some "https://www.biznest.space" (matching .env.example), others
// "https://biznest.vercel.app" -- so which one a customer landed on after
// paying depended on which file handled that particular redirect. That's
// exactly the kind of thing that looks like "I got logged out" or "my
// order disappeared" (see buildStoreUrl's own comment on why the redirect
// host matters for session cookies), even though the env var itself was
// fine — it only ever showed up when that var was missing (a preview
// deploy, local dev, or a misconfigured environment). Import APP_URL from
// here instead of reading process.env.NEXT_PUBLIC_APP_URL directly.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.biznest.space";
