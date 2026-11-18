import { describe, it, expect } from "vitest";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BRIDGE_SCRIPT } from "@/lib/hr/bridge-script";

const listen = (server: http.Server) => new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as { port: number }).port)));

describe("scanner bridge (real process, real HTTP)", () => {
  it("accepts a scanner push and forwards it to BizNest with the device key", async () => {
    const received: { auth?: string; body: any }[] = [];
    const upstream = http.createServer((req, res) => {
      let b = ""; req.on("data", (d) => (b += d));
      req.on("end", () => { received.push({ auth: req.headers.authorization, body: JSON.parse(b) }); res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}'); });
    });
    const upPort = await listen(upstream);
    const dir = mkdtempSync(join(tmpdir(), "bridge-"));
    const file = join(dir, "bridge.mjs");
    writeFileSync(file, BRIDGE_SCRIPT);
    const bridgePort = 18000 + Math.floor(Math.random() * 1000);
    const child = spawn(process.execPath, [file], {
      cwd: dir,
      env: { ...process.env, BIZNEST_URL: `http://127.0.0.1:${upPort}`, PORT: String(bridgePort), DEVICE_KEYS: "SN123=hrk_testkey", QUEUE_FILE: join(dir, "q.json") },
      stdio: "ignore",
    });
    try {
      let up = false;
      for (let i = 0; i < 40 && !up; i++) {
        await new Promise((r) => setTimeout(r, 100));
        up = await fetch(`http://127.0.0.1:${bridgePort}/iclock/getrequest?SN=SN123`).then((r) => r.ok).catch(() => false);
      }
      expect(up).toBe(true);
      const hs = await (await fetch(`http://127.0.0.1:${bridgePort}/iclock/cdata?SN=SN123&options=all`)).text();
      expect(hs).toContain("TransFlag=TransData AttLog");
      expect((await fetch(`http://127.0.0.1:${bridgePort}/iclock/cdata?SN=NOPE`)).status).toBe(403);
      const push = await fetch(`http://127.0.0.1:${bridgePort}/iclock/cdata?SN=SN123&table=ATTLOG`, { method: "POST", body: "12\t2026-11-18 08:02:11\t0\t1\n7\t2026-11-18 17:30:00\t1\t1\n" });
      expect(await push.text()).toBe("OK:2");
      for (let i = 0; i < 40 && !received.length; i++) await new Promise((r) => setTimeout(r, 100));
      expect(received[0].auth).toBe("Bearer hrk_testkey");
      expect(received[0].body).toEqual({ serial: "SN123", punches: [{ userId: "12", time: "2026-11-18 08:02:11" }, { userId: "7", time: "2026-11-18 17:30:00" }] });
    } finally { child.kill(); upstream.close(); }
  }, 15000);
});
