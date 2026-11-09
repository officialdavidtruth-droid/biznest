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

## Native features (added v124)

The Android app now uses three native plugins when running inside the app. In a normal browser the site falls back to its web behaviour.

- **Gallery** (`@capawesome/capacitor-file-picker`): the Browse composer opens the phone's own gallery. If the picked file cannot be read, it falls back to the normal file picker.
- **Share sheet** (`@capacitor/share`): sharing a Browse post opens the phone's share sheet.
- **Haptics** (`@capacitor/haptics`): available through `lib/native.ts` (`haptic()`).

To get these, rebuild the APK: run the "Build Android app" GitHub Action (it runs `npm install` and `npx cap sync android`). Not tested on a device yet, so test the gallery picker after the first build.

Still needed for native push notifications: a Firebase `google-services.json`. Web push does not run inside the WebView. iOS needs a Mac to build.
