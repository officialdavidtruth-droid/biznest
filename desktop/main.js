// BizNest desktop shell (Electron). It is a window around the live platform at https://biznest.space,
// so every site update shows up here instantly with no new installer. What the shell adds:
//   - its own window, icon and a single running copy;
//   - an offline page and an offline register (offline-pos.html) when there is no connection;
//   - device storage (preload.js) used by the register to keep its catalogue and unsent sales.
const { app, BrowserWindow, Menu, shell, dialog, session } = require("electron");
const path = require("path");
const crypto = require("crypto");
const updater = require("./updater");

const START_URL = process.env.BIZNEST_URL || "https://biznest.space/";
// Hosts that may open inside the app window (login, the dashboard, payment pages, product images).
const ALLOWED = [/(^|\.)biznest\.space$/, /(^|\.)paystack\.(com|co)$/, /(^|\.)flutterwave\.com$/, /(^|\.)korapay\.com$/, /^res\.cloudinary\.com$/];
const isAllowed = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") return true;
    return u.protocol === "https:" && ALLOWED.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
};

// Plain Chrome identity (no "Electron" token) so sites that sniff the user agent treat the window normally.
const PLATFORM_TOKEN = process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10_15_7" : "X11; Linux x86_64";
const CHROME_UA = `Mozilla/5.0 (${PLATFORM_TOKEN}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let win;

// ---- Google sign-in -------------------------------------------------------------------------------
// Google refuses to sign anyone in from inside an embedded app window, however it identifies itself
// ("This browser or app may not be secure"). So the Google step runs in the person's normal browser and the
// site hands the login back through biznest://auth?code=... The code only works with the random verifier
// below, which stays in this process (see lib/desktop-handoff.ts on the site).
const PROTOCOL = "biznest";
let pendingVerifier = null;

function isGoogleAuth(url) {
  try { return new URL(url).hostname === "accounts.google.com"; } catch { return false; }
}

function startBrowserSignIn() {
  pendingVerifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(pendingVerifier).digest("base64url");
  shell.openExternal(`${new URL(START_URL).origin}/desktop-auth/start?challenge=${challenge}`);
  if (win) win.loadFile(path.join(__dirname, "signing-in.html"), { query: { back: START_URL } });
}

function handleProtocolUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return; }
  if (u.protocol !== `${PROTOCOL}:` || u.hostname !== "auth") return;
  const code = u.searchParams.get("code");
  if (!code || !pendingVerifier || !win) return;
  const verifier = pendingVerifier;
  pendingVerifier = null; // one attempt per sign-in
  if (win.isMinimized()) win.restore();
  win.focus();
  win.loadURL(`${new URL(START_URL).origin}/desktop-auth/finish?code=${encodeURIComponent(code)}&verifier=${encodeURIComponent(verifier)}`);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0f6410",
    title: "BizNest",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs fs for device storage; it exposes only get/set via contextBridge
    },
  });

  win.webContents.setUserAgent(CHROME_UA);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuth(url)) { startBrowserSignIn(); return { action: "deny" }; }
    if (isAllowed(url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  const interceptGoogle = (e, url) => { if (isGoogleAuth(url)) { e.preventDefault(); startBrowserSignIn(); return true; } return false; };
  win.webContents.on("will-redirect", (e, url) => { interceptGoogle(e, url); });
  win.webContents.on("will-navigate", (e, url) => {
    if (interceptGoogle(e, url)) return;
    if (!isAllowed(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // No connection (or site unreachable): show the offline page instead of a blank window.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */) return;
    if (url.startsWith("file:")) return;
    win.loadFile(path.join(__dirname, "offline.html"), { query: { retry: url } });
  });

  win.loadURL(START_URL);
}

function buildMenu() {
  const template = [
    {
      label: "BizNest",
      submenu: [
        { label: "Home", accelerator: "CmdOrCtrl+H", click: () => win && win.loadURL(START_URL) },
        { label: "Offline register", accelerator: "CmdOrCtrl+Shift+O", click: () => win && win.loadFile(path.join(__dirname, "offline-pos.html")) },
        { type: "separator" },
        { role: "reload" },
        { role: "togglefullscreen" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }] },
    {
      label: "Help",
      submenu: [
        { label: "BizNest support", click: () => shell.openExternal("mailto:biznestsupport@gmail.com") },
        { label: "Check for updates…", click: () => updater.checkNow() },
        { label: `About (v${app.getVersion()})`, click: () => dialog.showMessageBox({ message: `BizNest Desktop v${app.getVersion()}`, detail: "Your store, orders, bookings and an offline register." }) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) handleProtocolUrl(link);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on("open-url", (e, url) => { e.preventDefault(); handleProtocolUrl(url); }); // macOS
  app.whenReady().then(() => {
    if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL);
    session.defaultSession.setUserAgent(CHROME_UA);
    buildMenu();
    createWindow();
    updater.init(() => win);
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
