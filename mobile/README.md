# BizNest Android app

Native Android shell (Capacitor) around the live platform at https://biznest.space.
Logins, stores, payments and data all stay on your existing Vercel + Supabase backend,
so every site update shows up in the app instantly, with no new APK needed.

## Get the APK (no Android Studio, no CLI)
1. Push this project to GitHub.
2. GitHub → **Actions** → **Build Android app** → **Run workflow**.
3. When it finishes (about 5 min), download `biznest.apk` from the run's **Artifacts**
   (also published at Releases → `android-latest`).
4. Put the file at `public/downloads/biznest.apk` and redeploy, or set
   `NEXT_PUBLIC_ANDROID_APK_URL` in Vercel to the release link. The `/download` page serves it.

## Play Store / permanent signing (do once)
Run **Generate Android signing key**, add the 4 secrets it lists, then run **Build Android app**.
It then produces a signed `biznest.apk` and a `biznest.aab` (the file Play Store wants).
Without the secrets you still get an installable debug-signed APK.

## Changing things
- Server URL, allowed payment domains, splash/status bar: `mobile/capacitor.config.json`
- Icons/splash: replace `public/icon-512.png`, run `python3 mobile/scripts/generate-assets.py`
- App id: `space.biznest.app`

## Known limits
- Google sign-in is blocked by Google inside any embedded WebView. Email/password login works.
- Web push (`sw.js`) doesn't run in Android WebView. Native push needs Firebase (`google-services.json`).
- iOS needs a Mac + Apple developer account. iPhone users install via Safari → Add to Home Screen.
