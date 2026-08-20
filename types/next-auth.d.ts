import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

// Extends Auth.js's built-in types with the fields we add in the jwt/session
// callbacks (lib/auth.ts). Without this, session.user.id and
// session.user.role don't exist on the type and every call site needs an
// `as` cast — this file is what removes the need for those casts.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      // Only set when this session came from a "Position@store" staff
      // sign-in (see authorize() in lib/auth.ts) — undefined for owners
      // and for staff who signed in with their own email instead.
      staffPosition?: string;
      storeSlug?: string;
      storeName?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    staffPosition?: string;
    storeSlug?: string;
    storeName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    banned?: boolean;
    staffPosition?: string;
    storeSlug?: string;
    storeName?: string;
  }
}
