import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CRONS } from "@/lib/observability/cron-registry";

const root = path.resolve(__dirname, "../..");
const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as {
  crons: { path: string; schedule: string }[];
};

describe("cron registry", () => {
  it("matches vercel.json exactly (paths and schedules)", () => {
    const fromVercel = vercel.crons.map((c) => `${c.path} ${c.schedule}`).sort();
    const fromRegistry = CRONS.map((c) => `${c.path} ${c.schedule}`).sort();
    expect(fromRegistry).toEqual(fromVercel);
  });

  it("every scheduled cron route is wrapped in withCronMonitor under its registry name", () => {
    for (const c of CRONS) {
      const file = path.join(root, "app", c.path, "route.ts");
      const src = readFileSync(file, "utf8");
      expect(src, `${c.name} must use withCronMonitor("${c.name}", ...)`).toContain(`withCronMonitor("${c.name}"`);
    }
  });

  it("no cron route is left unmonitored unless it is deliberately manual", () => {
    const manual = new Set(["wallet-payout-backfill"]);
    const dirs = readdirSync(path.join(root, "app/api/cron"));
    for (const d of dirs) {
      if (manual.has(d)) continue;
      expect(CRONS.some((c) => c.name === d), `app/api/cron/${d} is not in cron-registry.ts`).toBe(true);
    }
  });
});
