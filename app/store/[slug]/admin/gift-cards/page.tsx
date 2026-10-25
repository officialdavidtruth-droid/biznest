// Route: /store/[slug]/admin/gift-cards
import { prisma } from "@/lib/prisma";
import { GiftCardManager, type GiftCardRow } from "@/components/dashboard/gift-card-manager";

export default async function GiftCardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return null;

  const [cards, outstanding] = await Promise.all([
    prisma.giftCard.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 200 }),
    // Unspent value on live cards: what the store still "owes" in goods/services.
    prisma.giftCard.aggregate({
      where: { storeId: store.id, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      _sum: { balance: true },
    }),
  ]);

  const rows: GiftCardRow[] = cards.map((c) => ({
    id: c.id,
    code: c.code,
    initialAmount: Number(c.initialAmount),
    balance: Number(c.balance),
    status: c.status,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    recipientName: c.recipientName,
    recipientEmail: c.recipientEmail,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Gift cards</h1>
        <p className="text-sm text-muted-foreground">
          Unspent on active cards: <strong>₦{Number(outstanding._sum.balance ?? 0).toLocaleString()}</strong>
        </p>
      </div>
      <GiftCardManager slug={slug} cards={rows} />
    </div>
  );
}
