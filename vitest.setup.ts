import { vi } from "vitest";

/**
 * Global test mocks, loaded via vitest.config.ts's `setupFiles` for every
 * test file in the run. These stub the three things a "use server" action
 * needs that don't exist outside a real Next.js request: an authenticated
 * session, `revalidatePath`, and outbound webhook delivery. Everything
 * else (Prisma, business logic, the actual DB) runs for real against
 * whatever DATABASE_URL points at — see TESTING.md for how to point that
 * at a disposable test database.
 */

export type MockSessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  /** Set for store-scoped customer accounts (see requireStoreCustomerByStoreId). */
  customerStoreId?: string | null;
};

// Mutable holder so individual tests can swap the "logged in as" user via
// setSession()/clearSession() in beforeEach/afterEach without needing a
// fresh vi.mock per test file.
export const sessionState: { current: { user: MockSessionUser } | null } = { current: null };

export function setSession(user: MockSessionUser) {
  sessionState.current = { user };
}

export function clearSession() {
  sessionState.current = null;
}

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => sessionState.current),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  // Run the wrapped function directly -- no cache layer in tests.
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

// `cookies()` / `headers()` throw outside a Next.js request scope. Server
// actions read them (store-customer session, rate limiting, IP lookups), so
// give every test an empty, writable cookie jar and empty headers. A test
// file that needs specific values can still vi.mock("next/headers") itself.
vi.mock("next/headers", () => {
  const jar = new Map<string, string>();
  const cookieStore = {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
    set: (name: string, value?: string) => {
      jar.set(name, String(value ?? ""));
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  };
  return {
    cookies: vi.fn(async () => cookieStore),
    headers: vi.fn(async () => new Headers()),
  };
});

// Modules that construct the Resend client at import time throw without a key.
process.env.RESEND_API_KEY ||= "re_test_key";
// Own-gateway keys are encrypted with this when no dedicated key is set.
process.env.AUTH_SECRET ||= "test-auth-secret-for-vitest-only";

// emitWebhookEvent is safe to leave real in most cases (it's a no-op when
// a store has no subscribed endpoints, which test fixtures never create),
// but mocking it keeps tests fast and independent of that module's
// internals, and lets a test assert on which events fired if it wants to.
vi.mock("@/lib/webhooks/dispatch", () => ({
  emitWebhookEvent: vi.fn(async () => {}),
}));

// Best-effort audit logging — not part of what any of these tests are
// verifying, and mocking it avoids depending on StoreActivityLog's shape.
vi.mock("@/lib/activity-log", () => ({
  logStoreActivity: vi.fn(async () => {}),
  logActivity: vi.fn(async () => {}),
}));
