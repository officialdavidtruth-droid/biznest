// Exposes a tiny key/value store backed by a JSON file in the app's own data folder.
// The web register (lib/pos-offline.ts) and offline-pos.html share it, so sales rung up in the
// offline register are recorded by the online register on its next start.
const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

function dataDir() {
  const base = process.env.APPDATA || (process.platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support") : path.join(os.homedir(), ".config"));
  return path.join(base, "BizNest");
}
const file = path.join(dataDir(), "device-storage.json");

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(file, "utf8")); } catch { cache = {}; }
  return cache;
}
function save() {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, file); // atomic: a power cut never leaves half a file
  } catch { /* disk full or read-only: the register keeps working in memory */ }
}

contextBridge.exposeInMainWorld("bizNestDesktop", {
  isDesktop: true,
  checkForUpdates: () => ipcRenderer.send("biznest:check-updates"),
  storage: {
    get: (key) => { const v = load()[key]; return typeof v === "string" ? v : null; },
    set: (key, value) => { load()[key] = String(value); save(); },
  },
});
