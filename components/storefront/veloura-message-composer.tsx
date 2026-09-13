"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startStoreConversation, sendStoreMessage } from "@/lib/actions/account";
import { Send } from "lucide-react";
export function VelouraMessageComposer({slug,conversationId}:{slug:string;conversationId:string|null}){const[v,setV]=useState("");const[busy,setBusy]=useState(false);const router=useRouter();return <div className="veloura-chat-form"><input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(v.trim()){setBusy(true);(conversationId?sendStoreMessage(slug,conversationId,v):startStoreConversation(slug,v)).then(()=>{setV("");router.refresh()}).finally(()=>setBusy(false))}}}} placeholder="Type a message…"/><button disabled={busy||!v.trim()}><Send size={16}/></button></div>}
