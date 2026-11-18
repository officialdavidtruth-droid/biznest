import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from "@simplewebauthn/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreAccessRole } from "@/lib/access/store-access";
import { findMyEmployee } from "@/lib/hr/self";
import { recordPunches } from "@/lib/hr/attendance-service";

/**
 * Phone / laptop fingerprint or Face ID clock-in using WebAuthn. The device keeps the biometric;
 * we store only a public key and verify a signed challenge, so a punch proves the enrolled device
 * was unlocked with the person's own biometric (userVerification is required).
 *
 * POST { slug, step: "register-options" | "register-verify" | "login-options" | "login-verify", response? }
 */
export const dynamic = "force-dynamic";
const CHALLENGE_TTL_MS = 5 * 60_000;

function relyingParty(req: Request) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return { rpID: host.replace(/:\d+$/, ""), origin: `${proto}://${host}` };
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const toB64 = (u: Uint8Array) => Buffer.from(u).toString("base64url");
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return bad("Sign in first.", 401);
  const body = (await req.json().catch(() => null)) as { slug?: string; step?: string; response?: unknown; label?: string } | null;
  if (!body?.slug || !body.step) return bad("Missing slug or step.");

  const store = await prisma.store.findUnique({ where: { slug: body.slug }, include: { business: true } });
  if (!store) return bad("Store not found.", 404);
  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (role === null) return bad("You don't have access to this store.", 403);
  const employee = await findMyEmployee(store.id, { id: session.user.id, email: session.user.email });
  if (!employee) return bad("Your login isn't linked to an employee record yet. Ask HR to link it.", 404);

  const { rpID, origin } = relyingParty(req);
  const purpose = body.step.startsWith("register") ? "register" : "login";

  const takeChallenge = async () => {
    const row = await prisma.hrWebAuthnChallenge.findFirst({ where: { employeeId: employee.id, purpose }, orderBy: { expiresAt: "desc" } });
    await prisma.hrWebAuthnChallenge.deleteMany({ where: { employeeId: employee.id, purpose } });
    return row && row.expiresAt > new Date() ? row.challenge : null;
  };
  const saveChallenge = async (challenge: string) => {
    await prisma.hrWebAuthnChallenge.deleteMany({ where: { OR: [{ employeeId: employee.id, purpose }, { expiresAt: { lt: new Date() } }] } });
    await prisma.hrWebAuthnChallenge.create({ data: { employeeId: employee.id, purpose, challenge, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } });
  };

  try {
    if (body.step === "register-options") {
      const existing = await prisma.hrWebAuthnCredential.findMany({ where: { employeeId: employee.id }, select: { credentialId: true, transports: true } });
      const options = await generateRegistrationOptions({
        rpName: store.name, rpID,
        userName: `${employee.firstName} ${employee.lastName}`.trim() || employee.employeeNo,
        userID: new TextEncoder().encode(employee.id),
        attestationType: "none",
        excludeCredentials: existing.map((c: { credentialId: string; transports: string | null }) => ({ id: c.credentialId, transports: (c.transports?.split(",").filter(Boolean) ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      });
      await saveChallenge(options.challenge);
      return NextResponse.json(options);
    }

    if (body.step === "register-verify") {
      const expectedChallenge = await takeChallenge();
      if (!expectedChallenge) return bad("That request expired. Try again.");
      const v = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      });
      if (!v.verified || !v.registrationInfo) return bad("Couldn't verify this device.");
      const { credential } = v.registrationInfo;
      await prisma.hrWebAuthnCredential.create({
        data: {
          storeId: store.id, employeeId: employee.id, credentialId: credential.id, publicKey: toB64(credential.publicKey),
          counter: credential.counter, transports: credential.transports?.join(",") ?? null, label: (body.label ?? "").slice(0, 60) || null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.step === "login-options") {
      const creds = await prisma.hrWebAuthnCredential.findMany({ where: { employeeId: employee.id }, select: { credentialId: true, transports: true } });
      if (!creds.length) return bad("No fingerprint or face set up on this account yet.", 409);
      const options = await generateAuthenticationOptions({
        rpID, userVerification: "required",
        allowCredentials: creds.map((c: { credentialId: string; transports: string | null }) => ({ id: c.credentialId, transports: (c.transports?.split(",").filter(Boolean) ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
      });
      await saveChallenge(options.challenge);
      return NextResponse.json(options);
    }

    if (body.step === "login-verify") {
      const expectedChallenge = await takeChallenge();
      if (!expectedChallenge) return bad("That request expired. Try again.");
      const resp = body.response as AuthenticationResponseJSON;
      const cred = await prisma.hrWebAuthnCredential.findUnique({ where: { credentialId: resp?.id ?? "" } });
      if (!cred || cred.employeeId !== employee.id) return bad("This device isn't registered to you.", 403);
      const v = await verifyAuthenticationResponse({
        response: resp, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: cred.credentialId, publicKey: fromB64(cred.publicKey), counter: cred.counter, transports: (cred.transports?.split(",").filter(Boolean) ?? undefined) as AuthenticatorTransportFuture[] | undefined },
      });
      if (!v.verified) return bad("Biometric check failed.", 403);
      await prisma.hrWebAuthnCredential.update({ where: { id: cred.id }, data: { counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() } });
      const r = await recordPunches(store.id, [{ at: new Date(), source: "WEBAUTHN", employeeId: employee.id }]);
      return NextResponse.json({ ok: true, ...r });
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Biometric check failed.");
  }
  return bad("Unknown step.");
}
