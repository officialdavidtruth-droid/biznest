const PARTS=["year","month","day","hour","minute","second"] as const;
type Parts=Record<(typeof PARTS)[number],number>;
function parts(date:Date,tz:string):Parts{const f=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});const out=f.formatToParts(date);const r={} as Parts;for(const p of PARTS){const v=out.find(x=>x.type===p)?.value;r[p]=Number(v??0);}return r;}
function offsetMs(date:Date,tz:string){const p=parts(date,tz);const asUtc=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);return asUtc-date.getTime();}
export function zonedTimeToUtc(dateISO:string,timeHHMM:string,tz:string){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);const t=/^(\d{2}):(\d{2})$/.exec(timeHHMM);if(!m||!t)throw new Error("Invalid local date or time.");
 const guess=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(t[1]),Number(t[2]),0);let d=new Date(guess);d=new Date(guess-offsetMs(d,tz));return d;
}
export function getLocalDateKey(date:Date,tz:string){const p=parts(date,tz);return `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;}
export function localDateStartUtc(dateISO:string,tz:string){return zonedTimeToUtc(dateISO,"00:00",tz);}
export function localDateEndUtc(dateISO:string,tz:string){const start=localDateStartUtc(dateISO,tz);return new Date(start.getTime()+24*60*60*1000);}
export function getLocalMinutes(date:Date,tz:string){const p=parts(date,tz);return p.hour*60+p.minute;}
export function getLocalWeekday(dateISO:string,tz:string){const d=zonedTimeToUtc(dateISO,"12:00",tz);return new Intl.DateTimeFormat("en-US",{timeZone:tz,weekday:"short"}).format(d).slice(0,3).toLowerCase();}
export function addLocalDays(dateISO:string,days:number){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);if(!m)throw new Error("Invalid local date.");const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+days,12,0,0));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;}
