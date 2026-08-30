import Link from "next/link";
import { BookingWidget } from "@/components/storefront/booking-widget";

export function SignatureServiceDetail({store,slug,service,accent,ink,bg,radius,card,headlineFont}:{store:any;slug:string;service:any;accent:string;ink:string;bg:string;radius:string;card?:string;headlineFont?:string}){
 const image=service.images?.[0];
 return <section className="signature-service-detail"><div className="ssd-media" style={image?{backgroundImage:`url(${image})`}:undefined}>{!image&&service.name?.[0]}</div><div className="ssd-copy"><small>{service.category?.name||"SERVICE"}</small><h1>{service.name}</h1><div className="ssd-price">{service.currency} {Number(service.price).toLocaleString()} {service.durationMins&&!service.totalUnits&&<span>· {service.durationMins} min</span>}{service.totalUnits&&<span>· per night</span>}</div>{service.description&&<p>{service.description}</p>}{service.isBookable?<BookingWidget storeSlug={slug} serviceId={service.id} serviceName={service.name} servicePrice={Number(service.price)} currency={service.currency} durationMins={service.durationMins} totalUnits={service.totalUnits} accent={accent} ink={ink} bg={bg} radius={radius} card={card} headlineFont={headlineFont}/>:<Link className="ss-main-btn" href={`/store/${slug}/catalog`}>Continue</Link>}</div></section>
}
