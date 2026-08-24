import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// TEMPORARY — creates/resets one known demo login so you can see the app
// without going through registration + email verification while that's
// being debugged. Delete this file once real registration is confirmed
// working — it's a backdoor account creator and shouldn't stay deployed.
const DEMO_EMAIL = "timetone01@gmail.com";
const DEMO_PASSWORD = "zxcvbnm";

export async function GET() {
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    // Prisma's generated compound-unique input type doesn't accept `null`
    // for the second field, so upsert() can't target this row directly.
    // Do a manual find-then-create/update instead.
    const existing = await prisma.user.findFirst({
      where: { email: DEMO_EMAIL, customerScopeStoreId: null },
    });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            emailVerified: new Date(),
          },
        })
      : await prisma.user.create({
          data: {
            email: DEMO_EMAIL,
            name: "Demo User",
            passwordHash,
            emailVerified: new Date(),
            role: "CUSTOMER",
          },
        });

    return NextResponse.json({
      success: true,
      message: `Demo user ready. Log in at /login with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
      userId: user.id,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}