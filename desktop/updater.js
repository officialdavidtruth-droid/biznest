// In-app updates: the installer is only needed once. The app checks the "desktop-latest" release on
// start and every few hours, downloads a newer build in the background, and offers a restart.
//   Windows / Linux: silent download, one click to restart into the new version.
//   Mac: unsigned apps cannot replace themselves (Apple requires a paid signing certificate), so the
//        app tells the user a new version exists and opens the download page.
const { app, dialog, shell } = require("electron");

const DOWNLOAD_PAGE = "https://biznest.space/download";
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

let autoUpdater = null;
let manual = false;

function init(getWindow) {
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
  autoUpdater.on("update-downloaded", (info) => {
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
    if (manual) dialog.showMessageBox(getWindow() || undefined, { type: "info", message: "BizNest is up to date.", detail: `Version ${app.getVersion()}` });
    manual = false;
  });
  autoUpdater.on("error", (err) => {
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
  autoUpdater.checkForUpdates().catch(() => { manual = false; });
}

module.exports = { init, checkNow };
