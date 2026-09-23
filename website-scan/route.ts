import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMarketingToolAccess } from '@/lib/access/marketing-tool';
import { scanWebsite } from '@/lib/marketing/website-scanner';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const access = await getMarketingToolAccess(session.user.id);
  if (access.status !== 'active') return NextResponse.json({ error: 'An active BizNest Marketing workspace is required.' }, { status: 403 });
  const store = await prisma.store.findUnique({ where: { slug: access.storeSlug }, select: { id: true, marketingOnly: true } });
  if (!store?.marketingOnly) return NextResponse.json({ error: 'Marketing workspace not found.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.url !== 'string' || body.url.length > 500) return NextResponse.json({ error: 'Enter a valid website URL.' }, { status: 400 });
  try {
    const result = await scanWebsite(body.url);
    await prisma.$transaction(async tx => {
      await tx.marketingWebsiteConnection.upsert({ where:{storeId:store.id}, create:{storeId:store.id, websiteUrl:result.websiteUrl, businessName:result.businessName, businessType:result.businessType, logoUrl:result.logoUrl, primaryColor:result.primaryColor, secondaryColor:result.secondaryColor, description:result.description, contactEmail:result.contactEmail, contactPhone:result.contactPhone, socialLinks:result.socialLinks, pages:result.pages, lastScannedAt:new Date()}, update:{websiteUrl:result.websiteUrl,status:'CONNECTED',businessName:result.businessName,businessType:result.businessType,logoUrl:result.logoUrl,primaryColor:result.primaryColor,secondaryColor:result.secondaryColor,description:result.description,contactEmail:result.contactEmail,contactPhone:result.contactPhone,socialLinks:result.socialLinks,pages:result.pages,lastScannedAt:new Date()} });
      const seen = new Set<string>();
      for (const item of result.items) { seen.add(item.externalKey); const { metadata, ...rest } = item; const data = { ...rest, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined }; await tx.marketingCatalogItem.upsert({where:{storeId_externalKey:{storeId:store.id,externalKey:item.externalKey}},create:{storeId:store.id,...data},update:{...data,isActive:true,lastSeenAt:new Date()}}); }
      if (seen.size) await tx.marketingCatalogItem.updateMany({where:{storeId:store.id,externalKey:{notIn:[...seen]}},data:{isActive:false}});
    });
    return NextResponse.json({ success:true, data:result });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Website scan failed.' }, { status: 422 }); }
}
