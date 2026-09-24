"use client";
import { useState } from 'react';
import { Globe2, RefreshCw, CheckCircle2, Package, Palette, ExternalLink, ShieldCheck, Copy, Check, Mail } from 'lucide-react';

type Item={id:string;type:string;name:string;category?:string|null;imageUrl?:string|null;price?:string|null;salePrice?:string|null;currency?:string|null;url?:string|null;isActive:boolean};
type Connection={websiteUrl:string;websiteHost?:string;status?:string;verificationToken?:string;businessName?:string|null;businessType?:string|null;logoUrl?:string|null;primaryColor?:string|null;secondaryColor?:string|null;lastScannedAt?:string|null};

export function WebsiteConnector({initial,items:initialItems}:{initial:Connection|null;items:Item[]}){
 const [url,setUrl]=useState(initial?.websiteUrl||'');
 const [connection,setConnection]=useState(initial);
 const [items,setItems]=useState(initialItems);
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const [copied,setCopied]=useState(false);
 const [useEmail,setUseEmail]=useState(false);
 const [email,setEmail]=useState('');
 const [codeSent,setCodeSent]=useState(false);
 const [code,setCode]=useState('');
 const isPending = connection && connection.status !== 'CONNECTED';
 const isConnected = connection?.status === 'CONNECTED';

 async function call(action:string, body:Record<string,unknown> = {}){
   setMessage(''); setLoading(true);
   try{
     const r=await fetch('/api/marketing/website-scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...body})});
     const j=await r.json();
     if(!r.ok) throw new Error(j.error||'Something went wrong.');
     return j.data;
   } catch(e){ setMessage(e instanceof Error?e.message:'Website connection failed.'); return null; }
   finally { setLoading(false); }
 }

 async function connect(){
   const data = await call('connect', { url });
   if(!data) return;
   setConnection({ websiteUrl: data.websiteUrl, websiteHost: data.websiteHost, status: data.status, verificationToken: data.verificationToken });
   setMessage('Add the verification code below to your website, then click "I\'ve added it — verify". No developer access? Use email verification instead.');
 }

 async function verify(){
   const data = await call('verify');
   if(!data) return;
   setConnection(data);
   setItems((data.items||[]).map((x:any,i:number)=>({...x,id:`scan-${i}`,isActive:true})));
   setMessage(`Verified and connected. Found ${(data.items||[]).length} products, rooms or services.`);
 }

 async function refresh(){
   const data = await call('refresh');
   if(!data) return;
   setConnection(data);
   setItems((data.items||[]).map((x:any,i:number)=>({...x,id:`scan-${i}`,isActive:true})));
   setMessage(`Refreshed. Found ${(data.items||[]).length} products, rooms or services.`);
 }

 async function sendCode(){
   const data = await call('send-email-code', { email });
   if(!data) return;
   setCodeSent(true);
   setMessage(`We sent a 6-digit code to ${data.emailCodeSentTo}. It expires in 15 minutes.`);
 }

 async function verifyCode(){
   const data = await call('verify-email-code', { code });
   if(!data) return;
   setConnection(data);
   setItems((data.items||[]).map((x:any,i:number)=>({...x,id:`scan-${i}`,isActive:true})));
   setMessage(`Verified and connected. Found ${(data.items||[]).length} products, rooms or services.`);
 }

 function copyToken(){
   if(!connection?.verificationToken) return;
   navigator.clipboard?.writeText(connection.verificationToken);
   setCopied(true); setTimeout(()=>setCopied(false),1500);
 }

 return <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700"><Globe2 size={15}/> Website intelligence <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-normal text-slate-500 normal-case">Optional</span></p>
      <h2 className="mt-2 text-2xl font-black">Connect your existing website</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">BizNest scans public website content to understand the business, brand and things it sells. Those items become selectable content inside email campaigns. You can skip this and add it anytime.</p>
    </div>
    {isConnected && <span className="inline-flex h-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={14}/> Connected</span>}
    {isPending && <span className="inline-flex h-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><ShieldCheck size={14}/> Awaiting verification</span>}
  </div>

  {!connection && (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://yourbusiness.com" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-600"/>
      <button onClick={connect} disabled={loading||!url.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading?<RefreshCw className="animate-spin" size={16}/>:<Globe2 size={16}/>} {loading?'Checking…':'Connect website'}</button>
    </div>
  )}

  {isPending && !useEmail && (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="flex items-center gap-2 text-sm font-black text-amber-900"><ShieldCheck size={16}/> Prove you own {connection?.websiteUrl}</p>
      <p className="mt-2 text-sm leading-6 text-amber-900">To stop other people connecting a website they don't own, add this to your site before we import anything from it. Either works:</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-amber-900">
        <li>Add this meta tag to your homepage's <code>&lt;head&gt;</code>: <code className="rounded bg-white px-1.5 py-0.5">&lt;meta name="biznest-site-verification" content="{connection?.verificationToken}"&gt;</code></li>
        <li>Or create a file at <code className="rounded bg-white px-1.5 py-0.5">/.well-known/biznest-verify.txt</code> containing just the code below.</li>
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs">{connection?.verificationToken}</code>
        <button onClick={copyToken} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800">{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copied':'Copy'}</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={verify} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading?<RefreshCw className="animate-spin" size={16}/>:<ShieldCheck size={16}/>} {loading?'Verifying…':"I've added it — verify"}</button>
        <button onClick={()=>{setUseEmail(true);setMessage('');}} className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-800 underline">No developer access? Verify by email instead</button>
      </div>
    </div>
  )}

  {isPending && useEmail && (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="flex items-center gap-2 text-sm font-black text-amber-900"><Mail size={16}/> Verify with an email at {connection?.websiteHost}</p>
      <p className="mt-2 text-sm leading-6 text-amber-900">We'll email a 6-digit code to an address at your own domain (not a personal Gmail/Yahoo address) — only someone who controls that mailbox can receive it.</p>
      {!codeSent ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder={`you@${connection?.websiteHost||'yourbusiness.com'}`} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-600"/>
          <button onClick={sendCode} disabled={loading||!email.includes('@')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading?<RefreshCw className="animate-spin" size={16}/>:<Mail size={16}/>} {loading?'Sending…':'Send code'}</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm tracking-widest outline-none focus:border-emerald-600"/>
          <button onClick={verifyCode} disabled={loading||code.length!==6} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading?<RefreshCw className="animate-spin" size={16}/>:<ShieldCheck size={16}/>} {loading?'Verifying…':'Verify code'}</button>
        </div>
      )}
      <button onClick={()=>{setUseEmail(false);setCodeSent(false);setMessage('');}} className="mt-4 text-sm font-bold text-amber-800 underline">Use the website code method instead</button>
    </div>
  )}

  {isConnected && (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://yourbusiness.com" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-600" disabled/>
      <button onClick={refresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading?<RefreshCw className="animate-spin" size={16}/>:<Globe2 size={16}/>} {loading?'Refreshing…':'Refresh website data'}</button>
    </div>
  )}

  {message && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}

  {isConnected && <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
    <div className="rounded-2xl border bg-slate-50 p-5">
      <div className="flex items-center gap-3">
        {connection?.logoUrl?<img src={connection.logoUrl} className="h-12 w-12 rounded-xl object-contain bg-white p-2"/>:<div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Globe2 size={20}/></div>}
        <div><p className="font-black">{connection?.businessName||'Detected business'}</p><p className="text-xs text-slate-500">{connection?.businessType||'Business'}</p></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-3"><Palette size={15} className="text-emerald-700"/><p className="mt-2 text-[11px] text-slate-500">Brand colours</p><div className="mt-2 flex gap-2"><i className="h-6 w-6 rounded-full border" style={{background:connection?.primaryColor||'#0a6b3a'}}/><i className="h-6 w-6 rounded-full border" style={{background:connection?.secondaryColor||'#063b25'}}/></div></div>
        <div className="rounded-xl bg-white p-3"><Package size={15} className="text-emerald-700"/><p className="mt-2 text-[11px] text-slate-500">Marketing items</p><p className="mt-1 text-xl font-black">{items.length}</p></div>
      </div>
      <a href={connection?.websiteUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Open website <ExternalLink size={13}/></a>
    </div>
    <div className="rounded-2xl border p-5">
      <div className="flex items-center justify-between"><div><p className="text-sm font-black">Business catalog</p><p className="mt-1 text-xs text-slate-500">Select these in the email builder as dynamic content.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{items.length} found</span></div>
      {items.length?<div className="mt-4 grid max-h-72 gap-2 overflow-auto">{items.slice(0,40).map(item=><div key={item.id} className="flex items-center gap-3 rounded-xl border bg-white p-3">{item.imageUrl?<img src={item.imageUrl} className="h-11 w-11 rounded-lg object-cover"/>:<div className="h-11 w-11 rounded-lg bg-slate-100"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-slate-500">{item.type}{item.category?` · ${item.category}`:''}</p></div><div className="text-right text-xs font-bold">{item.salePrice&&<span className="mr-1 text-emerald-700">{item.salePrice}</span>}{item.price&&<span className={item.salePrice?'text-slate-400 line-through':'text-slate-700'}>{item.price}</span>}</div></div>)}</div>:<div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No structured products, rooms or services were detected yet. You can still use the website branding and connect supported forms later.</div>}
    </div>
  </div>}
 </section>;
}
