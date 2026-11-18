/**
 * The BizNest scanner bridge: a tiny Node.js program (no dependencies) that a business runs on any
 * always-on PC at the same site as its fingerprint scanner. The scanner pushes scans to it over the
 * local network (plain HTTP, which many older scanners require), and the bridge forwards them to
 * BizNest over HTTPS, keeping a queue on disk so nothing is lost if the internet drops.
 * Served from /api/hr/bridge. Requires Node 18 or newer.
 */
export const BRIDGE_SCRIPT = String.raw`#!/usr/bin/env node
// BizNest fingerprint scanner bridge. Run:  node biznest-bridge.mjs
// Settings (environment variables):
//   DEVICE_KEYS   required. "SERIAL=key" pairs, comma separated, from HR & Payroll > Scanners.
//   BIZNEST_URL   default https://biznest.space
//   PORT          default 8081 (point the scanner's server port here)
//   QUEUE_FILE    default ./biznest-bridge-queue.json
import http from "node:http";
import fs from "node:fs";

const BASE = (process.env.BIZNEST_URL || "https://biznest.space").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 8081);
const QUEUE_FILE = process.env.QUEUE_FILE || "./biznest-bridge-queue.json";
const KEYS = Object.fromEntries(
  (process.env.DEVICE_KEYS || "").split(",").map((p) => p.trim()).filter(Boolean).map((p) => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; })
);
if (!Object.keys(KEYS).length) { console.error("Set DEVICE_KEYS, e.g. DEVICE_KEYS=\"ABC123=hrk_xxx\""); process.exit(1); }

let queue = [];
try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")); } catch {}
const save = () => fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue));

async function flush() {
  const bySerial = new Map();
  for (const q of queue) { if (!bySerial.has(q.serial)) bySerial.set(q.serial, []); bySerial.get(q.serial).push(q); }
  for (const [serial, items] of bySerial) {
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500);
      try {
        const res = await fetch(BASE + "/api/hr/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEYS[serial] },
          body: JSON.stringify({ serial, punches: chunk.map((c) => ({ userId: c.userId, time: c.time })) }),
        });
        // 4xx means BizNest rejected it for good (bad key/serial/format): drop so we don't retry forever.
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          if (!res.ok) console.error("BizNest rejected scans for", serial, res.status, await res.text());
          queue = queue.filter((q) => !chunk.includes(q)); save();
        }
      } catch (e) { console.error("Offline, will retry:", e.message); return; }
    }
  }
}
setInterval(flush, 30000);

const HANDSHAKE = (sn) => ["GET OPTION FROM: " + sn, "ErrorDelay=60", "Delay=30", "TransTimes=00:00;14:05", "TransInterval=1", "TransFlag=TransData AttLog", "Realtime=1", "Encrypt=0", ""].join("\n");

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const sn = url.searchParams.get("SN");
  const reply = (code, text) => { res.writeHead(code, { "Content-Type": "text/plain" }); res.end(text); };
  if (!sn) return reply(400, "Missing SN");
  if (!KEYS[sn]) { console.error("Unknown scanner serial", sn, "- add it to DEVICE_KEYS"); return reply(403, "Unknown device"); }
  if (url.pathname === "/iclock/cdata" && req.method === "GET") return reply(200, HANDSHAKE(sn));
  if (url.pathname === "/iclock/getrequest") return reply(200, "OK");
  if (url.pathname === "/iclock/devicecmd") { req.resume(); return reply(200, "OK"); }
  if (url.pathname === "/iclock/cdata" && req.method === "POST") {
    let body = ""; req.on("data", (d) => { body += d; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => {
      if (url.searchParams.get("table") !== "ATTLOG") return reply(200, "OK");
      let n = 0;
      for (const line of body.split(/\r?\n/)) {
        const c = line.split("\t");
        if (c.length >= 2 && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(c[1])) { queue.push({ serial: sn, userId: c[0].trim(), time: c[1].trim() }); n++; }
      }
      save(); reply(200, "OK:" + n); flush();
    });
    return;
  }
  reply(404, "Not found");
}).listen(PORT, () => console.log("BizNest bridge listening on port " + PORT + " for " + Object.keys(KEYS).length + " scanner(s)."));
flush();
`;
