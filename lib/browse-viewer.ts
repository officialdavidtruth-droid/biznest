import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { DEVICE_ID_RE, deviceViewerKey, userViewerKey } from "@/lib/browse";

export const BROWSE_DEVICE_COOKIE = "bn-browse-viewer";

export type Viewer = { key: string; userId: string | null; name: string | null };

/**
 * Who is looking? A signed-in BizNest account (owner, staff, admin) is identified by user id;
 * everyone else by a random device id kept in a cookie. `create` mints the cookie (server actions only —
 * a page render can't set cookies, so there it returns null for a first-time visitor).
 */
export async function getViewer(opts: { create?: boolean } = {}): Promise<Viewer | null> {
  const session = await auth().catch(() => null);
  if (session?.user?.id) return { key: userViewerKey(session.user.id), userId: session.user.id, name: session.user.name ?? null };

  const jar = await cookies();
  let id = jar.get(BROWSE_DEVICE_COOKIE)?.value;
  if (!id || !DEVICE_ID_RE.test(id)) {
    if (!opts.create) return null;
    id = crypto.randomBytes(18).toString("base64url");
    jar.set(BROWSE_DEVICE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 365 * 24 * 3600, path: "/" });
  }
  return { key: deviceViewerKey(id), userId: null, name: null };
}
