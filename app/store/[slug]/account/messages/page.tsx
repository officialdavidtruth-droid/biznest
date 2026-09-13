import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getGeneralStoreConversation, listStoreConversations, markStoreMessagesRead } from "@/lib/actions/account";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";
import { VelouraMessageComposer } from "@/components/storefront/veloura-message-composer";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const{slug}=await params;
 const[store,session,conversation,conversations,hotel]=await Promise.all([getStoreBranding(slug),getStoreCustomerSessionForStore(slug),getGeneralStoreConversation(slug),listStoreConversations(slug),getHotelContent(slug)]);
 if(!store||!session?.user)notFound();
 void markStoreMessagesRead(slug);
 const hero=hotel.rooms[0]?.image||null;
 return <div className="veloura-account-content">
  <VelouraAccountHero title="Messages" subtitle="Stay connected with our team. Send your inquiries, requests, or special arrangements — we’re here to assist you." image={hero}/>
  <div className="veloura-message-layout">
   <div className="veloura-thread">
    <div style={{padding:16,borderBottom:"1px solid #eef0ed"}}><h2 style={{font:"20px Georgia,serif",margin:0}}>Messages ({conversations.length})</h2></div>
    {conversations.length ? conversations.map((c:any)=><div className="veloura-thread-item" key={c.id}><div className="veloura-thread-avatar">✦</div><div><strong>{c.participants.find((p:any)=>p.userId!==session.user.id)?.user.name||store.name}</strong><p>{c.messages[0]?.content||"No messages yet."}</p></div></div>) : <div className="veloura-empty" style={{margin:15}}>No messages yet.</div>}
   </div>
   <div className="veloura-chat">
    <div className="veloura-chat-head"><strong>{store.name} Team</strong><small style={{display:"block",color:"#279451"}}>● Available</small></div>
    <div className="veloura-chat-body">
     {conversation?.messages?.length ? conversation.messages.map((m:any)=><div key={m.id} className={`veloura-bubble ${m.senderId===session.user.id?"mine":""}`}>{m.content}<small style={{display:"block",opacity:.55,marginTop:5}}>{new Date(m.createdAt).toLocaleString()}</small></div>) : <div className="veloura-empty">Start a conversation with the hotel team.</div>}
    </div>
    <VelouraMessageComposer slug={slug} conversationId={conversation?.id??null}/>
   </div>
  </div>
 </div>
}
