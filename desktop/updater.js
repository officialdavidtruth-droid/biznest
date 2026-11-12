// In-app updates: the installer is only needed once. The app checks the "desktop-latest" release on
// start and every few hours, downloads a newer build in the background, and offers a restart.
//   Windows / Linux: silent download, one click to restart into the new version.
//   Mac: unsigned apps cannot replace themselves (Apple requires a paid signing certificate), so the
//        app tells the user a new version exists and opens the download page.
const { app, dialog, shell, BrowserWindow } = require("electron");

const DOWNLOAD_PAGE = "https://biznest.space/download";
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

let autoUpdater = null;
let manual = false;
let prog = null;

// Small modal progress window shown for manual checks: "Checking…" then a download bar.
const PROG_HTML = `<!doctype html><meta charset=utf-8><style>
html,body{margin:0;height:100%;font-family:system-ui,Segoe UI,sans-serif;background:#0f2a14;color:#fff;overflow:hidden;user-select:none}
.w{display:flex;flex-direction:column;justify-content:center;height:100%;padding:0 28px;gap:10px}
h1{font-size:15px;margin:0;font-weight:600}p{font-size:12px;margin:0;opacity:.75}
.bar{height:8px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden}
.fill{height:100%;width:30%;background:#4ade80;border-radius:99px;animation:ind 1.1s ease-in-out infinite}
.det .fill{animation:none;transition:width .2s}
@keyframes ind{0%{margin-left:-30%}100%{margin-left:100%}}
</style><div class=w id=w><h1 id=t>Checking for updates…</h1><div class=bar><div class=fill id=f></div></div><p id=s>Please wait</p></div>
<script>window.set=(t,s,p)=>{document.getElementById('t').textContent=t;document.getElementById('s').textContent=s||'';
const w=document.getElementById('w'),f=document.getElementById('f');if(p==null){w.classList.remove('det')}else{w.classList.add('det');f.style.width=p+'%'}}</script>`;

function showProgress(getWindow) {
  if (prog && !prog.isDestroyed()) return;
  prog = new BrowserWindow({
    width: 380, height: 130, resizable: false, minimizable: false, maximizable: false,
    parent: getWindow() || undefined, modal: !!getWindow(), autoHideMenuBar: true, title: "BizNest updates",
    backgroundColor: "#0f2a14", show: false, webPreferences: { sandbox: true },
  });
  prog.setMenu(null);
  prog.once("ready-to-show", () => prog && prog.show());
  prog.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(PROG_HTML));
}
function setProgress(t, s, p) {
  if (prog && !prog.isDestroyed()) prog.webContents.executeJavaScript(`set(${JSON.stringify(t)},${JSON.stringify(s)},${p == null ? "null" : p})`).catch(() => {});
}
function hideProgress() {
  if (prog && !prog.isDestroyed()) prog.close();
  prog = null;
}

let getWin = () => null;
function init(getWindow) {
  getWin = getWindow;
  if (!app.isPackaged) return; // no updates while running from source
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch {
    return;
  }
  const canSelfUpdate = process.platform !== "darwin";
  autoUpdater.autoDownload = canSelfUpdate;
  autoUpdater.autoInstallOnAppQuit = canSelfUpdate;

  autoUpdater.on("update-available", (info) => {
    if (manual && canSelfUpdate) setProgress(`Downloading BizNest ${info.version}`, "Starting…", 0);
    else hideProgress();
    if (!canSelfUpdate) {
      dialog
        .showMessageBox(getWindow() || undefined, {
          type: "info",
          message: `BizNest ${info.version} is available`,
          detail: "Download the new version from the BizNest download page.",
          buttons: ["Open download page", "Later"],
          defaultId: 0,
        })
        .then((r) => { if (r.response === 0) shell.openExternal(DOWNLOAD_PAGE); });
    }
  });
  autoUpdater.on("download-progress", (p) => {
    if (manual) setProgress("Downloading update", `${Math.round(p.percent)}% · ${(p.bytesPerSecond / 1048576).toFixed(1)} MB/s`, Math.round(p.percent));
  });
  autoUpdater.on("update-downloaded", (info) => {
    manual = false;
    hideProgress();
    dialog
      .showMessageBox(getWindow() || undefined, {
        type: "info",
        message: `BizNest ${info.version} is ready`,
        detail: "Restart now to finish updating. Sales saved offline stay on this computer.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
      })
      .then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
  });
  autoUpdater.on("update-not-available", () => {
    hideProgress();
    if (manual) dialog.showMessageBox(getWindow() || undefined, { type: "info", message: "BizNest is up to date.", detail: `Version ${app.getVersion()}` });
    manual = false;
  });
  autoUpdater.on("error", (err) => {
    hideProgress();
    if (manual) dialog.showMessageBox(getWindow() || undefined, { type: "warning", message: "Couldn't check for updates.", detail: String((err && err.message) || err).slice(0, 200) });
    manual = false;
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 15 * 1000);
  setInterval(check, CHECK_EVERY_MS);
}

function checkNow() {
  if (!autoUpdater) {
    dialog.showMessageBox({ type: "info", message: "Updates are checked automatically in the installed app." });
    return;
  }
  manual = true;
  showProgress(getWin);
  autoUpdater.checkForUpdates().catch(() => { manual = false; hideProgress(); });
}

module.exports = { init, checkNow };
