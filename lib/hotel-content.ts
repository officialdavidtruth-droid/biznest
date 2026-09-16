import { prisma } from "@/lib/prisma";

export const HOTEL_TEMPLATE_NAME = "Veloura — Superior Luxury Hotel";
export const HOTEL_GALLERY_CATEGORIES = ["All", "Hotel Interior", "Rooms", "Dining", "Amenities", "Events", "Meetings & Conferences", "Outdoor Spaces", "Our People"] as const;
export const HOTEL_OFFER_CATEGORIES = ["All Offers", "Room Packages", "Dining Offers", "Spa & Wellness", "Business Travel", "Long Stay", "Seasonal"] as const;
export const HOTEL_AMENITY_CATEGORIES = ["All Amenities", "Wellness & Fitness", "Business & Events", "Dining & Leisure", "Guest Services", "Convenience"] as const;

export type HotelRoom = { id:string; slug:string; name:string; description:string; price:number; image:string; badge?:string; bed:string; guests:number; area:string; view:string; amenities:string[]; featured?:boolean };
export type HotelOffer = { id:string; title:string; category:string; description:string; price:number; image:string; badge:string; benefits:string[] };
export type HotelGalleryItem = { id:string; title:string; category:string; image:string; description?:string };
export type HotelEvent = { id:string; slug:string; title:string; category:string; date:string; time:string; venue:string; description:string; details:string; image:string };
export type HotelAmenity = { id:string; title:string; category:string; description:string; image:string; icon:string };
export type HotelPageContent = {
  eyebrow:string; title:string; subtitle:string; image:string;
  body?:string; ctaLabel?:string; ctaHref?:string;
  cards?:Array<{id:string;title:string;eyebrow?:string;description:string;image:string;meta?:string;href?:string}>;
  features?:Array<{id:string;title:string;description:string;icon?:string}>;
  stats?:Array<{id:string;value:string;label:string}>;
};
export type HotelContent = {
  rooms:HotelRoom[]; offers:HotelOffer[]; gallery:HotelGalleryItem[]; events:HotelEvent[]; amenities:HotelAmenity[];
  home:HotelPageContent; dining:HotelPageContent; experiences:HotelPageContent; about:HotelPageContent; contact:HotelPageContent;
  _serviceMap?:Record<string,string>;
};

const IMG = (id:string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=85`;
const page=(v:Partial<HotelPageContent>):HotelPageContent=>({eyebrow:"THE LUSSO",title:"A Higher Standard of Hospitality",subtitle:"Thoughtfully designed spaces, exceptional service and experiences worth remembering.",image:IMG("photo-1566073771259-6a8506099945"),...v});

const defaults:HotelContent = {
  rooms:[
    {id:"superior",slug:"superior-luxury-room",name:"Superior Room",description:"A calm, beautifully appointed retreat with generous space and city views.",price:140000,image:IMG("photo-1611892440504-42a792e24d32"),badge:"Best Value",bed:"King Bed",guests:2,area:"36 m²",view:"City View",amenities:["Premium bedding","High-speed Wi-Fi","Smart TV","Mini bar","Work desk","Luxury bathroom"],featured:true},
    {id:"deluxe",slug:"deluxe-room",name:"Deluxe Room",description:"Comfort meets elegance in a refined room designed for modern travellers.",price:120000,image:IMG("photo-1584132967334-10e028bd69f7"),badge:"Most Popular",bed:"King Bed",guests:2,area:"32 m²",view:"City View",amenities:["Premium bedding","High-speed Wi-Fi","Smart TV","Mini bar","Work desk","In-room safe"],featured:true},
    {id:"executive",slug:"executive-suite",name:"Executive Suite",description:"More room, more privacy and a dedicated living area for business or leisure.",price:180000,image:IMG("photo-1566665797739-1674de7a421a"),bed:"King Bed",guests:2,area:"48 m²",view:"Panoramic View",amenities:["Separate lounge","Premium bath","Coffee station","Work desk","Wi-Fi","City view"],featured:true},
    {id:"presidential",slug:"presidential-suite",name:"Presidential Suite",description:"The ultimate Lusso experience with expansive living spaces and panoramic views.",price:350000,image:IMG("photo-1590490360182-c33d57733427"),badge:"Signature",bed:"Super King Bed",guests:4,area:"75 m²",view:"Panoramic View",amenities:["Living room","Dining area","Premium bath","Butler service","Guest powder room","Private lounge"],featured:true},
    {id:"twin",slug:"twin-room",name:"Twin Room",description:"A flexible room for friends, colleagues and family stays.",price:140000,image:IMG("photo-1582719478250-c89cae4dc85b"),bed:"Twin Beds",guests:2,area:"34 m²",view:"City View",amenities:["Twin beds","Wi-Fi","Smart TV","Tea & coffee","Work desk"]},
    {id:"accessible",slug:"accessible-room",name:"Accessible Room",description:"Thoughtfully designed comfort with accessibility features and generous circulation space.",price:140000,image:IMG("photo-1566073771259-6a8506099945"),bed:"King Bed",guests:2,area:"38 m²",view:"City View",amenities:["Accessible bathroom","Roll-in shower","Wi-Fi","Smart TV","Emergency call system"]}
  ],
  offers:[
    {id:"long",title:"Stay Longer. Experience More",category:"Long Stay",description:"Enjoy preferred rates and more time to settle into Lusso.",price:0,image:IMG("photo-1564501049412-61c2a3083791"),badge:"LONG STAY",benefits:["Preferred room rate","Flexible dates","Breakfast options"]},
    {id:"dine",title:"Dine & Unwind",category:"Dining Offers",description:"Pair your stay with an exceptional Lusso dining experience.",price:85000,image:IMG("photo-1517248135467-4c7edcad34c4"),badge:"DINING",benefits:["Dinner for two","Welcome drink","Priority reservation"]},
    {id:"wellness",title:"Relax & Rejuvenate",category:"Spa & Wellness",description:"A restorative stay designed around wellness.",price:70000,image:IMG("photo-1540555700478-4be289fbecef"),badge:"WELLNESS",benefits:["Spa treatment","Pool access","Wellness consultation"]}
  ],
  gallery:[
    ["Lobby","Hotel Interior","photo-1566073771259-6a8506099945"],["Deluxe Room","Rooms","photo-1584132967334-10e028bd69f7"],["Infinity Pool","Amenities","photo-1540541338287-41700207dee6"],["Fine Dining","Dining","photo-1517248135467-4c7edcad34c4"],["Meeting Room","Meetings & Conferences","photo-1497366754035-f200968a6e72"],["Wellness","Amenities","photo-1540555700478-4be289fbecef"],["Terrace","Outdoor Spaces","photo-1519167758481-83f550bb49b3"],["Exterior","Hotel Interior","photo-1564501049412-61c2a3083791"],["Fitness Centre","Amenities","photo-1534438327276-14e5300c3a48"],["Private Dining","Dining","photo-1515003197210-e0cd71810b5f"]
  ].map(([title,category,id],i)=>({id:`gallery-${i}`,title,category,image:IMG(id)})),
  events:[],
  amenities:[
    ["Infinity Pool","Wellness & Fitness","Unwind with skyline views and a peaceful poolside setting.","photo-1540541338287-41700207dee6","pool"],["Fitness Centre","Wellness & Fitness","State-of-the-art equipment for guests who want to keep moving.","photo-1534438327276-14e5300c3a48","fitness"],["Spa & Wellness","Wellness & Fitness","Rejuvenating treatments and quiet spaces designed to restore.","photo-1540555700478-4be289fbecef","spa"],["Fine Dining Restaurant","Dining & Leisure","Local ingredients and international favourites in an elegant setting.","photo-1517248135467-4c7edcad34c4","dining"],["Meeting & Event Spaces","Business & Events","Flexible spaces for meetings, conferences and celebrations.","photo-1497366754035-f200968a6e72","events"],["Executive Lounge","Guest Services","A private space for premium guests to work, meet and unwind.","photo-1519167758481-83f550bb49b3","lounge"],["Airport Shuttle","Convenience","Comfortable and reliable transfers by arrangement.","photo-1549317661-bd32c8ce0db2","transfer"],["Secure Parking","Convenience","Ample parking and guest arrival support.","photo-1503376780353-7e6692767b70","parking"],["Kids' Corner","Guest Services","A safe and comfortable space for younger guests.","photo-1602002418082-a4443e081dd1","family"]
  ].map(([title,category,description,image,icon],i)=>({id:`amenity-${i}`,title,category,description,image:IMG(image),icon})),
  home:page({eyebrow:"REFINED STAYS FOR A GREATER YOU",title:"More Than a Stay",subtitle:"Thoughtfully designed rooms, exceptional service and memorable experiences in the heart of Abuja.",image:IMG("photo-1566073771259-6a8506099945"),body:"The Lusso brings together comfort, culture and contemporary hospitality for business, leisure and every occasion.",ctaLabel:"Book Your Stay",ctaHref:"/book",stats:[{id:"rooms",value:"50+",label:"Luxurious Rooms & Suites"},{id:"rating",value:"5★",label:"Guest Experience"},{id:"guests",value:"10K+",label:"Happy Guests"},{id:"years",value:"3+",label:"Years of Excellence"}]}),
  dining:page({eyebrow:"DINING AT LUSSO",title:"A Table Worth Remembering",subtitle:"Thoughtfully crafted cuisine, locally inspired ingredients and unhurried hospitality.",image:IMG("photo-1517248135467-4c7edcad34c4"),body:"Dining at The Lusso is more than a meal — it is a ritual. Discover refined all-day dining, relaxed lounge moments and open-air terrace evenings.",ctaLabel:"Book a Table",ctaHref:"/dining",cards:[{id:"restaurant",title:"The Lusso Restaurant",eyebrow:"ALL-DAY DINING",description:"Refined Nigerian and international favourites served in an elegant setting.",image:IMG("photo-1517248135467-4c7edcad34c4"),meta:"6:30 AM – 11:00 PM"},{id:"lounge",title:"The Lounge",eyebrow:"COFFEE · TEA · PASTRIES",description:"A relaxed space for coffee, afternoon tea and meaningful conversations.",image:IMG("photo-1519167758481-83f550bb49b3"),meta:"7:00 AM – 10:00 PM"},{id:"terrace",title:"The Terrace",eyebrow:"COCKTAILS · GRILL · VIEWS",description:"Open-air dining with signature cocktails, grilled specialities and skyline views.",image:IMG("photo-1540541338287-41700207dee6"),meta:"4:00 PM – 12:00 AM"}]}),
  experiences:page({eyebrow:"MORE THAN A HOTEL",title:"Experiences That Stay With You",subtitle:"From cultural discoveries to curated moments of relaxation, discover the best of Abuja and beyond.",image:IMG("photo-1540541338287-41700207dee6"),body:"Every Lusso experience is designed to help you see, taste and feel the destination in a more meaningful way.",ctaLabel:"Plan Your Experience",ctaHref:"/contact",cards:[{id:"culinary",title:"A Taste of Abuja",eyebrow:"CULINARY",description:"Savour exceptional cuisine inspired by local flavours and international classics.",image:IMG("photo-1517248135467-4c7edcad34c4")},{id:"wellness",title:"Relax & Rejuvenate",eyebrow:"WELLNESS",description:"Refresh your mind and body with spa, fitness and restorative experiences.",image:IMG("photo-1540555700478-4be289fbecef")},{id:"culture",title:"Discover Abuja",eyebrow:"CULTURE & CITY",description:"Explore landmarks, art, culture and hidden gems with curated local guidance.",image:IMG("photo-1564501049412-61c2a3083791")},{id:"business",title:"Work, Connect, Achieve",eyebrow:"BUSINESS",description:"Elegant meeting spaces and corporate experiences for productive stays.",image:IMG("photo-1497366754035-f200968a6e72")},{id:"romance",title:"Moments Together",eyebrow:"ROMANCE",description:"Celebrate love with private dining, romantic room setups and special surprises.",image:IMG("photo-1515003197210-e0cd71810b5f")},{id:"family",title:"For Every Generation",eyebrow:"FAMILY",description:"Fun and memorable experiences designed for both kids and adults.",image:IMG("photo-1602002418082-a4443e081dd1")}]}),
  about:page({eyebrow:"OUR STORY",title:"A Higher Standard of Hospitality",subtitle:"The Lusso Hotel & Suites brings together luxury, comfort and authentic Nigerian hospitality to create extraordinary stays.",image:IMG("photo-1566073771259-6a8506099945"),body:"We exist to redefine hospitality in Nigeria by providing world-class accommodation, exceptional service and memorable experiences for every guest.",ctaLabel:"Book Your Stay",ctaHref:"/book",features:[{id:"excellence",title:"Excellence",description:"We deliver outstanding service in every detail.",icon:"diamond"},{id:"people",title:"People First",description:"Our guests, team members and community matter.",icon:"users"},{id:"authenticity",title:"Authenticity",description:"Proudly Nigerian, globally inspired.",icon:"leaf"},{id:"trust",title:"Trust",description:"We build lasting relationships through integrity.",icon:"shield"}],stats:[{id:"rooms",value:"50+",label:"Luxurious Rooms & Suites"},{id:"rating",value:"5★",label:"Guest Rating"},{id:"guests",value:"10K+",label:"Happy Guests"},{id:"years",value:"3+",label:"Years of Excellence"}]}),
  contact:page({eyebrow:"GET IN TOUCH",title:"We’re Here for You",subtitle:"Whether you’re planning a stay, a special occasion, a business event or simply have a question, our team is ready to assist you.",image:IMG("photo-1566073771259-6a8506099945"),body:"Conveniently located in the heart of Abuja, The Lusso offers easy access to business districts, government offices, shopping destinations and cultural landmarks."})
};

autoPopulateEvents();
function autoPopulateEvents(){
  defaults.events=[
    {id:"wine-dinner",slug:"an-evening-of-fine-wines",title:"An Evening of Fine Wines",category:"Culinary",date:"2026-10-18",time:"7:00 PM – 10:00 PM",venue:"The Lusso Restaurant",description:"A curated five-course menu paired with premium wines.",details:"An intimate evening of chef-led courses and guided pairings.",image:IMG("photo-1510812431401-41d2bd2722f3")},
    {id:"jazz",slug:"jazz-under-the-stars",title:"Jazz Under the Stars",category:"Entertainment",date:"2026-10-24",time:"8:00 PM – 11:00 PM",venue:"The Terrace",description:"Live jazz, crafted cocktails and skyline views.",details:"An evening of live music and relaxed Lusso hospitality.",image:IMG("photo-1514525253161-7a46d19cd819")},
    {id:"summit",slug:"business-growth-summit",title:"Business Growth Summit",category:"Business",date:"2026-11-03",time:"9:00 AM – 5:00 PM",venue:"Conference Centre",description:"A day of insights, networking and opportunities.",details:"Keynotes, networking and premium hospitality for modern professionals.",image:IMG("photo-1505373877841-8d25f7d46678")}
  ];
}

export async function getHotelContent(slug:string):Promise<HotelContent>{
  const store=await prisma.store.findUnique({where:{slug},select:{id:true,name:true}}); if(!store)return defaults;
  const [pages,services]=await Promise.all([
    prisma.storePage.findMany({where:{storeId:store.id,slug:{in:["hotel-home","hotel-rooms","hotel-offers","hotel-gallery","hotel-events","hotel-amenities","hotel-contact","hotel-dining","hotel-experiences","hotel-about"]}}}),
    prisma.service.findMany({where:{storeId:store.id,isPublished:true},orderBy:{createdAt:"asc"},select:{id:true,slug:true,name:true,description:true,images:true,price:true,attributes:true,isBookable:true,totalUnits:true,currency:true}})
  ]);
  const map=new Map(pages.map(p=>[p.slug,p.content as any]));
  const realRooms:HotelRoom[]=services.map(s=>{
    const a=(s.attributes as any)||{};
    return {id:s.id,slug:s.slug,name:s.name,description:s.description,price:Number(s.price),image:s.images[0]||"",badge:a.featured?"Featured":undefined,bed:a.bedType||"King Bed",guests:Number(a.maxGuests)||2,area:a.roomSize?`${a.roomSize} m²`:"—",view:a.view||"City View",amenities:["High-speed Wi-Fi",a.breakfast&&`Breakfast: ${a.breakfast}`,a.floor&&`Floor: ${a.floor}`].filter(Boolean) as string[],featured:Boolean(a.featured)};
  });
  const storeName = store.name ?? "This Hotel";
  const safePage = (fallbackTitle: string, fallbackSubtitle: string, key: string): HotelPageContent => ({
    eyebrow: storeName.toUpperCase(),
    title: fallbackTitle,
    subtitle: fallbackSubtitle,
    image: services[0]?.images?.[0] || "",
    ...(map.get(key)?.page || map.get(key)?.home || {}),
  });
  return {
    rooms: realRooms.length ? realRooms : (map.get("hotel-rooms")?.rooms ?? []),
    offers: map.get("hotel-offers")?.offers ?? [],
    gallery: map.get("hotel-gallery")?.items ?? [],
    events: map.get("hotel-events")?.events ?? [],
    amenities: map.get("hotel-amenities")?.amenities ?? [],
    home: map.get("hotel-home")?.page ?? map.get("hotel-home")?.home ?? safePage("Welcome to our hotel", "Comfortable stays, thoughtful service and a location that works for you.", "hotel-home"),
    dining: map.get("hotel-dining")?.page ?? safePage("Dining at our hotel", "Discover the food and beverage experiences currently offered by this property.", "hotel-dining"),
    experiences: map.get("hotel-experiences")?.page ?? safePage("Experiences", "Explore the experiences and activities available at this property.", "hotel-experiences"),
    about: map.get("hotel-about")?.page ?? safePage("About us", "Learn more about this property and the people behind it.", "hotel-about"),
    contact: map.get("hotel-contact")?.page ?? safePage("Contact us", "Get in touch with the property for reservations, questions and assistance.", "hotel-contact"),
    _serviceMap:Object.fromEntries(services.flatMap(s=>[[s.id,s.id],[s.slug,s.id],[s.name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),s.id]])),
  };
}

export { defaults as DEFAULT_HOTEL_CONTENT };
