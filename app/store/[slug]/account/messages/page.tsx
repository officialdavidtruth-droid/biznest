import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getGeneralStoreConversation, listStoreConversations, markStoreMessagesRead } from "@/lib/actions/account";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";
import { VelouraMessageComposer } from "@/components/storefront/veloura-message-composer";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { formatDate } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { parseMessagingConfig } from "@/lib/store-chat";
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const{slug}=await params;
 const[store,session,conversation,conversations,hotel]=await Promise.all([getStoreBranding(slug),getStoreCustomerSessionForStore(slug),getGeneralStoreConversation(slug),listStoreConversations(slug),getHotelContent(slug)]);
 if(!store||!session?.user)notFound();
 void markStoreMessagesRead(slug);
 const chatStore=await prisma.store.findUnique({where:{slug},select:{messagingConfig:true,businessType:true,business:{select:{category:true}}}});
 const chat=parseMessagingConfig(chatStore?.messagingConfig,getCanonicalBusinessType({businessCategory:chatStore?.business.category,storeBusinessType:chatStore?.businessType}));
 const needsHuman=!!(conversation as any)?.needsHuman;
 const hero=hotel.rooms[0]?.image||null;
 return <div className="veloura-account-content">
  {/* A vendor's reply shows up within a few seconds, without the customer reloading. */}
  <AutoRefresh intervalMs={4000}/>
  <VelouraAccountHero title="Messages" subtitle="Stay connected with our team. Send your inquiries, requests, or special arrangements — we’re here to assist you." image={hero}/>
  <div className="veloura-message-layout">
   <div className="veloura-thread">
    <div style={{padding:16,borderBottom:"1px solid #eef0ed"}}><h2 style={{font:"20px Georgia,serif",margin:0}}>Messages ({conversations.length})</h2></div>
    {conversations.length ? conversations.map((c:any)=><div className="veloura-thread-item" key={c.id}><div className="veloura-thread-avatar">✦</div><div><strong>{c.participants.find((p:any)=>p.userId!==session.user.id)?.user.name||store.name}</strong><p>{c.messages[0]?.content||"No messages yet."}</p></div></div>) : <div className="veloura-empty" style={{margin:15}}>No messages yet.</div>}
   </div>
   <div className="veloura-chat">
    <div className="veloura-chat-head"><strong>{store.name} Team</strong><small style={{display:"block",color:"#279451"}}>● Available</small></div>
    <div className="veloura-chat-body">
     {conversation?.messages?.length ? conversation.messages.map((m:any)=><div key={m.id} className={`veloura-bubble ${m.senderId===session.user.id?"mine":""}`}>{m.isAutomated&&<small style={{display:"block",opacity:.6,marginBottom:3,fontWeight:600}}>Automatic reply</small>}{m.content}<small style={{display:"block",opacity:.55,marginTop:5}}>{formatDate(new Date(m.createdAt), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</small></div>) : <div className="veloura-empty">Start a conversation with {store.name}.</div>}
    </div>
    <VelouraMessageComposer slug={slug} conversationId={conversation?.id??null} faqs={chat.faqs.filter(f=>f.enabled).map(f=>({id:f.id,question:f.question}))} humanHandoff={chat.humanHandoff} needsHuman={needsHuman}/>
   </div>
  </div>
 </div>
}
