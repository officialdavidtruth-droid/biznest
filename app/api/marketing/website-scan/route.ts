import { NextResponse } from 'next/server';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMarketingToolAccess } from '@/lib/access/marketing-tool';
import { scanWebsite, hostOf, verifyWebsiteOwnership } from '@/lib/marketing/website-scanner';
import { sendBrandedHtmlEmail } from '@/lib/email/send';

const COOLDOWN_MS = 60_000; // one attempt per minute per store, to stop this endpoint being used as an SSRF/scan proxy against arbitrary hosts
const CODE_TTL_MS = 15 * 60_000;

async function requireStore() {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Please sign in.', status: 401 } as const;
  const access = await getMarketingToolAccess(session.user.id);
  if (access.status !== 'active') return { error: 'An active BizNest Marketing workspace is required.', status: 403 } as const;
  const store = await prisma.store.findUnique({ where: { slug: access.storeSlug }, select: { id: true, marketingOnly: true } });
  if (!store?.marketingOnly) return { error: 'Marketing workspace not found.', status: 404 } as const;
  return { store } as const;
}

type ConnRecord = Awaited<ReturnType<typeof prisma.marketingWebsiteConnection.findUnique>>;

// Shared by both proof paths (site token or emailed code): once ownership is
// established, scan the site and save its brand/catalog. Re-checks the
// domain-uniqueness constraint at the moment of saving too, since time has
// passed since the initial "connect" request.
async function finalizeConnection(storeId: string, record: NonNullable<ConnRecord>) {
  const result = await scanWebsite(record.websiteUrl);
  const claimedElsewhere = await prisma.marketingWebsiteConnection.findFirst({ where: { websiteHost: record.websiteHost, storeId: { not: storeId }, status: 'CONNECTED' }, select: { id: true } });
  if (claimedElsewhere) throw Object.assign(new Error('This website was just connected to another BizNest Marketing account.'), { status: 409 });

  await prisma.$transaction(async tx => {
    await tx.marketingWebsiteConnection.update({
      where: { storeId },
      data: { status: 'CONNECTED', verifiedAt: new Date(), emailCode: null, emailCodeSentTo: null, emailCodeExpiresAt: null, websiteUrl: result.websiteUrl, businessName: result.businessName, businessType: result.businessType, logoUrl: result.logoUrl, primaryColor: result.primaryColor, secondaryColor: result.secondaryColor, description: result.description, contactEmail: result.contactEmail, contactPhone: result.contactPhone, socialLinks: result.socialLinks, pages: result.pages, lastScannedAt: new Date() },
    });
    const seen = new Set<string>();
    for (const item of result.items) {
      seen.add(item.externalKey);
      const { metadata, ...rest } = item;
      const data = { ...rest, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined };
      await tx.marketingCatalogItem.upsert({ where: { storeId_externalKey: { storeId, externalKey: item.externalKey } }, create: { storeId, ...data }, update: { ...data, isActive: true, lastSeenAt: new Date() } });
    }
    if (seen.size) await tx.marketingCatalogItem.updateMany({ where: { storeId, externalKey: { notIn: [...seen] } }, data: { isActive: false } });
  });
  return { status: 'CONNECTED', ...result };
}

export async function POST(req: Request) {
  const auth1 = await requireStore();
  if ('error' in auth1) return NextResponse.json({ error: auth1.error }, { status: auth1.status });
  const store = auth1.store;
  const body = await req.json().catch(() => ({}));
  const action: string = ['verify', 'send-email-code', 'verify-email-code'].includes(body.action) ? body.action : 'connect';

  if (action === 'connect') {
    if (typeof body.url !== 'string' || body.url.length > 500) return NextResponse.json({ error: 'Enter a valid website URL.' }, { status: 400 });
    let host: string;
    try { host = hostOf(body.url); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Enter a valid website URL.' }, { status: 400 }); }

    const existingForStore = await prisma.marketingWebsiteConnection.findUnique({ where: { storeId: store.id } });
    if (existingForStore?.lastAttemptAt && Date.now() - existingForStore.lastAttemptAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429 });
    }
    const claimedElsewhere = await prisma.marketingWebsiteConnection.findFirst({ where: { websiteHost: host, storeId: { not: store.id }, status: 'CONNECTED' }, select: { id: true } });
    if (claimedElsewhere) {
      return NextResponse.json({ error: 'This website is already connected to another BizNest Marketing account. If this is your website, contact support.' }, { status: 409 });
    }

    const token = existingForStore && existingForStore.websiteHost === host && existingForStore.status === 'PENDING_VERIFICATION'
      ? existingForStore.verificationToken
      : crypto.randomBytes(16).toString('hex');

    const record = await prisma.marketingWebsiteConnection.upsert({
      where: { storeId: store.id },
      create: { storeId: store.id, websiteUrl: body.url.trim(), websiteHost: host, status: 'PENDING_VERIFICATION', verificationToken: token, lastAttemptAt: new Date() },
      update: { websiteUrl: body.url.trim(), websiteHost: host, status: 'PENDING_VERIFICATION', verificationToken: token, lastAttemptAt: new Date(), emailCode: null, emailCodeSentTo: null, emailCodeExpiresAt: null },
    });
    return NextResponse.json({ success: true, data: { status: 'PENDING_VERIFICATION', websiteUrl: record.websiteUrl, verificationToken: record.verificationToken, websiteHost: record.websiteHost } });
  }

  const record = await prisma.marketingWebsiteConnection.findUnique({ where: { storeId: store.id } });
  if (!record) return NextResponse.json({ error: 'Connect a website first.' }, { status: 400 });

  if (action === 'verify') {
    if (record.lastAttemptAt && Date.now() - record.lastAttemptAt.getTime() < COOLDOWN_MS) return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429 });
    await prisma.marketingWebsiteConnection.update({ where: { storeId: store.id }, data: { lastAttemptAt: new Date() } });
    const owned = await verifyWebsiteOwnership(record.websiteUrl, record.verificationToken);
    if (!owned) return NextResponse.json({ error: `We couldn't find your verification code on ${record.websiteHost} yet. Add it and try again.` }, { status: 422 });
    try { return NextResponse.json({ success: true, data: await finalizeConnection(store.id, record) }); }
    catch (e) {
      await prisma.marketingWebsiteConnection.update({ where: { storeId: store.id }, data: { status: 'FAILED' } });
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Website scan failed.' }, { status: (e as { status?: number })?.status ?? 422 });
    }
  }

  if (action === 'send-email-code') {
    // Restricted to an address AT the domain being claimed -- a personal
    // gmail/yahoo address proves nothing about who controls the website.
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const emailHost = email.split('@')[1];
    if (!email.includes('@') || !emailHost || (emailHost !== record.websiteHost && !emailHost.endsWith(`.${record.websiteHost}`))) {
      return NextResponse.json({ error: `Use an email address at ${record.websiteHost} (e.g. you@${record.websiteHost}), not a personal email.` }, { status: 400 });
    }
    if (record.lastAttemptAt && Date.now() - record.lastAttemptAt.getTime() < COOLDOWN_MS) return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429 });
    const code = crypto.randomInt(100000, 999999).toString();
    await prisma.marketingWebsiteConnection.update({ where: { storeId: store.id }, data: { emailCode: code, emailCodeSentTo: email, emailCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS), lastAttemptAt: new Date() } });
    await sendBrandedHtmlEmail(email, 'Your BizNest website verification code', `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:24px;">Use this code in BizNest Marketing to confirm you own <strong>${record.websiteHost}</strong>:</p><p style="margin:0 0 16px;font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p><p style="margin:0;color:#6b7280;font-size:13px;">This code expires in 15 minutes. If you didn't request this, you can ignore it.</p>`, 'BizNest Marketing');
    return NextResponse.json({ success: true, data: { status: 'CODE_SENT', emailCodeSentTo: email } });
  }

  if (action === 'verify-email-code') {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!record.emailCode || !record.emailCodeExpiresAt) return NextResponse.json({ error: 'Request a code first.' }, { status: 400 });
    if (record.emailCodeExpiresAt.getTime() < Date.now()) return NextResponse.json({ error: 'That code has expired. Request a new one.' }, { status: 422 });
    if (code.length !== 6 || code !== record.emailCode) return NextResponse.json({ error: 'That code is incorrect.' }, { status: 422 });
    try { return NextResponse.json({ success: true, data: await finalizeConnection(store.id, record) }); }
    catch (e) {
      await prisma.marketingWebsiteConnection.update({ where: { storeId: store.id }, data: { status: 'FAILED' } });
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Website scan failed.' }, { status: (e as { status?: number })?.status ?? 422 });
    }
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
