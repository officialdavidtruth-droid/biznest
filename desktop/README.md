# BizNest desktop app (Windows, Mac, Linux)

An Electron window around the live platform at https://biznest.space, so every site update appears
instantly with no new installer. It adds an offline register: the POS keeps a copy of the catalogue and
saves sales rung up with no connection (`lib/pos-offline.ts`); they are recorded automatically, using each
sale's original idempotency key so nothing is recorded twice, the next time the register is open online.
When the site cannot be reached the app shows `offline.html`, which links to `offline-pos.html` (a
standalone register that works from the saved catalogue). Menu: BizNest → Offline register (Ctrl/Cmd+Shift+O).

## Build
GitHub → Actions → **Build desktop app** → Run workflow. It publishes `BizNest-Setup.exe`, `BizNest.dmg` and
`BizNest.AppImage` to the release **desktop-latest**. The installers are unsigned (Windows SmartScreen and
Mac Gatekeeper warn once; code-signing certificates remove that).

## Serving the downloads
`/download/desktop/<windows|mac|linux>` (app/download/desktop/[platform]/route.ts) redirects to the release
asset. The repo is public, so no token is needed. If it is made private again, set **GITHUB_RELEASE_TOKEN**
in Vercel (fine-grained token, read-only *Contents*) and the route fetches a signed link instead.

## Run locally
`cd desktop && npm install && npm start` (set `BIZNEST_URL=http://localhost:3000/` to point at a dev server).
