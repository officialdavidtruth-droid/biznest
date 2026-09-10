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
}));

// emitWebhookEvent is safe to leave real in most cases (it's a no-op when
// a store has no subscribed endpoints, which test fixtures never create),
// but mocking it keeps tests fast and independent of that module's
// internals, and lets a test assert on which events fired if it wants to.
vi.mock("@/lib/webhooks/dispatch", () => ({
  emitWebhookEvent: vi.fn(async () => {}),
}));

// Best-effort audit logging — not part of what any of these tests are
// verifying, and mocking it avoids depending on StoreActivityLog's shape.
vi.mock("@/lib/actions/activity", () => ({
  logStoreActivity: vi.fn(async () => {}),
}));
