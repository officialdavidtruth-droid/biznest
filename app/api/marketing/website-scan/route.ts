import { NextResponse } from 'next/server';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMarketingToolAccess } from '@/lib/access/marketing-tool';
import { scanWebsite, hostOf, verifyWebsiteOwnership } from '@/lib/marketing/website-scanner';

const COOLDOWN_MS = 60_000; // one attempt per minute per store, to stop this endpoint being used as an SSRF/scan proxy against arbitrary hosts

async function requireStore() {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Please sign in.', status: 401 } as const;
  const access = await getMarketingToolAccess(session.user.id);
  if (access.status !== 'active') return { error: 'An active BizNest Marketing workspace is required.', status: 403 } as const;
  const store = await prisma.store.findUnique({ where: { slug: access.storeSlug }, select: { id: true, marketingOnly: true } });
  if (!store?.marketingOnly) return { error: 'Marketing workspace not found.', status: 404 } as const;
  return { store } as const;
}

export async function POST(req: Request) {
  const auth1 = await requireStore();
  if ('error' in auth1) return NextResponse.json({ error: auth1.error }, { status: auth1.status });
  const store = auth1.store;
  const body = await req.json().catch(() => ({}));
  const action = body.action === 'verify' ? 'verify' : 'connect';

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
      update: { websiteUrl: body.url.trim(), websiteHost: host, status: 'PENDING_VERIFICATION', verificationToken: token, lastAttemptAt: new Date() },
    });
    return NextResponse.json({ success: true, data: { status: 'PENDING_VERIFICATION', websiteUrl: record.websiteUrl, verificationToken: record.verificationToken } });
  }

  // action === 'verify': confirm the token is actually present on the site, THEN scan and save.
  const record = await prisma.marketingWebsiteConnection.findUnique({ where: { storeId: store.id } });
  if (!record) return NextResponse.json({ error: 'Connect a website first.' }, { status: 400 });
  if (record.lastAttemptAt && Date.now() - record.lastAttemptAt.getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429 });
  }
  await prisma.marketingWebsiteConnection.update({ where: { storeId: store.id }, data: { lastAttemptAt: new Date() } });

  const owned = await verifyWebsiteOwnership(record.websiteUrl, record.verificationToken);
  if (!owned) {
    return NextResponse.json({ error: `We couldn't find your verification code on ${record.websiteHost} yet. Add it and try again.` }, { status: 422 });
  }

  try {
    const result = await scanWebsite(record.websiteUrl);
    // Re-check uniqueness at save time in case another account verified the same host in the meantime.
    const claimedElsewhere = await prisma.marketingWebsiteConnection.findFirst({ where: { websiteHost: record.websiteHost, storeId: { not: store.id }, status: 'CONNECTED' }, select: { id: true } });
    if (claimedElsewhere) return NextResponse.json({ error: 'This website was just connected to another BizNest Marketing account.' }, { status: 409 });

    await prisma.$transaction(async tx => {
      await tx.marketingWebsiteConnection.update({
        where: { storeId: store.id },
        data: { status: 'CONNECTED', verifiedAt: new Date(), websiteUrl: result.websiteUrl, businessName: result.businessName, businessType: result.businessType, logoUrl: result.logoUrl, primaryColor: result.primaryColor, secondaryColor: result.secondaryColor, description: result.description, contactEmail: result.contactEmail, contactPhone: result.contactPhone, socialLinks: result.socialLinks, pages: result.pages, lastScannedAt: new Date() },
      });
      const seen = new Set<string>();
      for (const item of result.items) {
        seen.add(item.externalKey);
        const { metadata, ...rest } = item;
        const data = { ...rest, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined };
        await tx.marketingCatalogItem.upsert({ where: { storeId_externalKey: { storeId: store.id, externalKey: item.externalKey } }, create: { storeId: store.id, ...data }, update: { ...data, isActive: true, lastSeenAt: new Date() } });
      }
      if (seen.size) await tx.marketingCatalogItem.updateMany({ where: { storeId: store.id, externalKey: { notIn: [...seen] } }, data: { isActive: false } });
    });
    return NextResponse.json({ success: true, data: { status: 'CONNECTED', ...result } });
  } catch (e) {
    await prisma.marketingWebsiteConnection.update({ where: { storeId: store.id }, data: { status: 'FAILED' } });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Website scan failed.' }, { status: 422 });
  }
}
