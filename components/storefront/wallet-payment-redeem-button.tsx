"use client";
import { useTransition } from "react";
import { redeemWalletPaymentRequest } from "@/lib/actions/customer-wallet";
import { toast } from "sonner";
export function WalletPaymentRedeemButton({ slug, token }: { slug: string; token: string }) { const [pending,startTransition]=useTransition(); return <button disabled={pending} onClick={()=>startTransition(async()=>{const r=await redeemWalletPaymentRequest(slug,token); if(!r.success){toast.error(r.error);return;} toast.success("Wallet payment completed."); window.location.reload();})} className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending?"Charging wallet…":"Charge customer wallet"}</button>; }

