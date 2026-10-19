import "server-only";
import { settleAndPayout } from "@/lib/payments/payout";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

/**
 * PMS reservation payment settlement.
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

/**
 * Settles a PMS reservation payment. Called from the Paystack/Flutterwave
 * webhook and callback routes for references starting "RES-", the same
 * way settleServiceBookingPayment (lib/actions/customer-wallet.ts) is
 * called for "BK-" references.
 */
export async function settleReservationPayment(
 reference:string,
 provider:"PAYSTACK"|"FLUTTERWAVE",
 verifiedAmountNaira:number,
 rawPayload:object
):Promise<ActionResult<{storeSlug:string;reservationId:string}>>{
 const payment=await prisma.payment.findUnique({where:{reference},include:{reservation:{include:{store:true}}}});
 if(!payment||payment.purpose!=="PMS_RESERVATION"||!payment.reservation)return{success:false,error:"Reservation payment not found."};
 if(payment.provider!==provider)return{success:false,error:"Payment provider mismatch."};
 if(payment.status==="SUCCESSFUL")return{success:true,data:{storeSlug:payment.reservation.store.slug,reservationId:payment.reservation.id}};
 if(payment.status!=="PENDING")return{success:false,error:"Reservation payment is not pending."};
 if(verifiedAmountNaira<Number(payment.amount))return{success:false,error:"Payment amount mismatch."};

 await prisma.$transaction(async(tx)=>{
  const result=await tx.payment.updateMany({where:{id:payment.id,status:"PENDING"},data:{status:"SUCCESSFUL",rawPayload,verifiedAt:new Date()}});
  if(result.count===0)return;
  await tx.propertyReservation.updateMany({where:{id:payment.reservation!.id,status:{not:"CANCELLED"},paymentStatus:{not:"PAID"}},data:{paymentStatus:"PAID",paymentReference:reference}});
 });

 await settleAndPayout(reference);

 revalidatePath(`/store/${payment.reservation.store.slug}/admin/pms`);
 return{success:true,data:{storeSlug:payment.reservation.store.slug,reservationId:payment.reservation.id}};
                                                           }
