import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.setup.ts"],
    // The DB integration tests (lib/actions/__tests__) each do several
    // sequential writes/transactions against a real database — the
    // default 5s per-test timeout is too tight for that, especially the
    // concurrent-oversell tests that deliberately run overlapping
    // transactions.
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
