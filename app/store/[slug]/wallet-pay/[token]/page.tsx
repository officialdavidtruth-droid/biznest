import { getWalletPaymentRequest } from "@/lib/actions/customer-wallet";
import { WalletPaymentRedeemButton } from "@/components/storefront/wallet-payment-redeem-button";
import { redirect } from "next/navigation";

export default async function WalletPayPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const request = await getWalletPaymentRequest(slug, token);
  if (!request) redirect(`/login?callbackUrl=/store/${encodeURIComponent(slug)}/wallet-pay/${encodeURIComponent(token)}`);
  const expired = request.expiresAt <= new Date();
  return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-md rounded-3xl bg-white p-7 shadow-xl"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">BizNest wallet payment</p><h1 className="mt-2 text-2xl font-bold text-slate-950">{request.booking.service.name}</h1><p className="mt-2 text-sm text-slate-500">Customer: {request.wallet.user.name ?? request.wallet.user.email}</p><div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs text-white/60">Amount</p><p className="mt-1 text-3xl font-bold">₦{Number(request.amount).toLocaleString()}</p><p className="mt-2 text-xs text-white/50">Expires {request.expiresAt.toLocaleTimeString()}</p></div>{request.status === "PENDING" && !expired ? <WalletPaymentRedeemButton slug={slug} token={token} /> : <p className="mt-6 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">This payment request is no longer active.</p>}</div></main>;
}

