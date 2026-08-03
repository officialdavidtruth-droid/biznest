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

    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      create: {
        email: DEMO_EMAIL,
        name: "Demo User",
        passwordHash,
        emailVerified: new Date(),
        role: "CUSTOMER",
      },
      update: {
        passwordHash,
        emailVerified: new Date(),
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
