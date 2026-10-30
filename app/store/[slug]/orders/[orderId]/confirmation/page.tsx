import {redirect} from "next/navigation"; import {OrderConfirmation} from "@/components/storefront/order-confirmation"; import {resolveStorePalette} from "@/lib/store-palette";
import {getOrderForBuyer} from "@/lib/actions/order"; import {notFound} from "next/navigation"; import {getGrandeurRestaurantData} from "@/lib/grandeur-restaurant"; import {TasteHouseConfirmation} from "@/components/storefront/tastehouse"; import {GrandeurConfirmation} from "@/components/storefront/grandeur-restaurant"; import {ExampleConfirmation} from "@/components/storefront/example-confirmation"; import {prisma} from "@/lib/prisma"; import {TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME} from "@/lib/template-themes";
import {TrackPurchase} from "@/components/storefront/store-tracking";
import {OrderStatusNotice, NOTICE_STATUSES} from "@/components/storefront/order-status-notice";

// Only orders that have actually been paid for count as a conversion. An order
// still waiting on its gateway (PENDING_PAYMENT), or one that was cancelled /
// refunded / disputed, must not be reported to an ad account as a sale.
const COUNTED_STATUSES = new Set(["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"]);

export default async function Page({params}:{params:Promise<{slug:string;orderId:string}>}){
  const {slug,orderId}=await params;
  const order=await getOrderForBuyer(orderId,slug);
  if(!order)notFound();
  // Bank-transfer order the vendor hasn't confirmed yet: this is not a confirmation, send them to pay/upload proof.
  if(order.status==="PENDING_PAYMENT"&&order.paymentProvider==="CASH")redirect(`/store/${slug}/orders/${orderId}/pay`);
  // Only paid/fulfilled orders get the "confirmed" screens. Anything else (still
  // waiting on the gateway, cancelled, refunded, disputed) gets an honest notice.
  if(NOTICE_STATUSES.includes(String(order.status)))return renderNotice(slug,order);
  const view=await renderConfirmation(slug,order);
  // One tracker for every confirmation skin (default, TasteHouse, Grandeur, Example).
  const items=(order.items??[]).map((i:any)=>({id:String(i.productId??i.serviceId??i.id),name:String(i.product?.name??i.service?.name??"Item"),price:Number(i.unitPrice),quantity:i.quantity}));
  return <>{COUNTED_STATUSES.has(String(order.status))&&<TrackPurchase slug={slug} transactionId={order.id} currency={order.currency} value={Number(order.total||0)} items={items}/>}{COUNTED_STATUSES.has(String(order.status))&&<DigitalDownloads slug={slug} orderId={order.id} items={order.items??[]}/>}{view}</>;
}

// Shared across every confirmation skin: paid digital items get a download link.
function DigitalDownloads({slug,orderId,items}:{slug:string;orderId:string;items:any[]}){
  const files=items.filter((i)=>i.product?.type==="DIGITAL"&&i.product?.digitalFileUrl);
  if(!files.length)return null;
  return <section style={{maxWidth:640,margin:"1rem auto",padding:"1rem 1.25rem",border:"1px solid rgba(0,0,0,.12)",borderRadius:12,background:"#fff",color:"#111"}}>
    <h2 style={{fontSize:16,fontWeight:700,margin:0}}>Your downloads</h2>
    <ul style={{margin:"0.5rem 0 0",padding:0,listStyle:"none"}}>
      {files.map((i)=><li key={i.id} style={{padding:"0.35rem 0"}}><a href={`/store/${slug}/orders/${orderId}/download/${i.id}`} style={{fontWeight:600,textDecoration:"underline"}}>Download {i.product.name}</a></li>)}
    </ul>
  </section>;
}

async function renderNotice(slug:string,order:NonNullable<Awaited<ReturnType<typeof getOrderForBuyer>>>){
  const s=await prisma.store.findUnique({where:{slug},include:{template:true,business:true}});
  if(!s||s.status!=="ACTIVE")notFound();
  return <OrderStatusNotice slug={slug} storeName={s.name} orderCode={order.id.slice(-8).toUpperCase()} status={order.status as "PENDING_PAYMENT"|"CANCELLED"|"REFUNDED"|"DISPUTED"} palette={resolveStorePalette(s)} contactEmail={order.store?.contactEmail} contactPhone={order.store?.contactPhone}/>;
}

async function renderConfirmation(slug:string,order:NonNullable<Awaited<ReturnType<typeof getOrderForBuyer>>>){
  const s=await prisma.store.findUnique({where:{slug},include:{template:true,business:true}});
  if(s?.template?.name===EXAMPLE_TEMPLATE_NAME)return <ExampleConfirmation store={{...s,sellsProducts:s.business?.sellsProducts??true}} slug={slug} order={order}/>;
  if(s?.template?.name===TASTEHOUSE_TEMPLATE_NAME)return <TasteHouseConfirmation store={{...s,sellsProducts:s.business?.sellsProducts??true}} slug={slug} order={order}/>;
  const data=await getGrandeurRestaurantData(slug);
  if(data)return <GrandeurConfirmation store={data.store} slug={slug} order={order}/>;
  if(!s||s.status!=="ACTIVE")notFound();
  return <OrderConfirmation slug={slug} storeName={s.name} order={order} palette={resolveStorePalette(s)}/>;
}
