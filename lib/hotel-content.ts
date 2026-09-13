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
export type HotelContent = { rooms:HotelRoom[]; offers:HotelOffer[]; gallery:HotelGalleryItem[]; events:HotelEvent[]; amenities:HotelAmenity[]; dining:any[]; home:any; contact:any };

const IMG = (id:string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`;
const defaults: HotelContent = {
 rooms:[
  {id:"superior",slug:"superior-luxury-room",name:"Superior Luxury Room",description:"Spacious, elegant, and thoughtfully designed for a relaxing stay.",price:180000,image:IMG("photo-1611892440504-42a792e24d32"),badge:"Best Value",bed:"King Size Bed",guests:2,area:"36 m²",view:"City View",amenities:["High-Speed Wi-Fi","Smart TV","Mini Bar","Work Desk","In-Room Safe","Luxury Bathroom"],featured:true},
  {id:"deluxe",slug:"deluxe-room",name:"Deluxe Room",description:"Modern comfort with enhanced amenities and generous space.",price:150000,image:IMG("photo-1584132967334-10e028bd69f7"),badge:"Most Popular",bed:"King Bed",guests:2,area:"32 m²",view:"City View",amenities:["Free Wi-Fi","Breakfast Option","Smart TV","Mini Bar"],featured:true},
  {id:"executive",slug:"executive-room",name:"Executive Room",description:"More space, more elegance, ideal for business and leisure travellers.",price:220000,image:IMG("photo-1566665797739-1674de7a421a"),bed:"King Bed",guests:2,area:"36 m²",view:"Panoramic View",amenities:["King Bed","Work Desk","High-Speed Wi-Fi","Lounge Area"],featured:true},
  {id:"presidential",slug:"presidential-room",name:"Presidential Room",description:"The ultimate luxury experience with premium amenities and panoramic city views.",price:450000,image:IMG("photo-1590490360182-c33d57733427"),badge:"Luxury",bed:"Super King Bed",guests:4,area:"75 m²",view:"City View",amenities:["Living Room","Dining Area","Premium Bath","Butler Service"],featured:true},
  {id:"family",slug:"family-room",name:"Family Room",description:"A comfortable retreat designed for families and small groups.",price:300000,image:IMG("photo-1582719478250-c89cae4dc85b"),bed:"2 King Beds",guests:4,area:"45 m²",view:"City View",amenities:["Two Beds","Family Lounge","Wi-Fi","Breakfast Option"]},
  {id:"business",slug:"business-room",name:"Business Room",description:"Designed for productivity and comfort between meetings.",price:200000,image:IMG("photo-1566073771259-6a8506099945"),bed:"King Bed",guests:2,area:"32 m²",view:"City View",amenities:["Work Desk","Fast Wi-Fi","Meeting Access","Coffee Station"]},
  {id:"suite-city",slug:"suite-city-view",name:"Suite (City View)",description:"A refined space with stunning views and a separate living area.",price:380000,image:IMG("photo-1591088398332-8a7791972843"),bed:"King Bed",guests:2,area:"50 m²",view:"City View",amenities:["Separate Lounge","Bathtub","Minibar","Wi-Fi"]}
 ],
 offers:[
  {id:"weekend",title:"Weekend Escape",category:"Room Packages",description:"Enjoy a luxurious weekend with breakfast, late check-out, and more.",price:120000,image:IMG("photo-1564501049412-61c2a3083791"),badge:"BEST VALUE",benefits:["Luxury Room","Breakfast for 2","Late Check-out"]},
  {id:"dine",title:"Dine & Unwind",category:"Dining Offers",description:"A perfect blend of fine dining and relaxation.",price:85000,image:IMG("photo-1517248135467-4c7edcad34c4"),badge:"DINING",benefits:["3-Course Dinner for 2","Complimentary Wine","Pool Access"]},
  {id:"wellness",title:"Relax & Rejuvenate",category:"Spa & Wellness",description:"Pamper yourself with our exclusive spa package.",price:70000,image:IMG("photo-1540555700478-4be289fbecef"),badge:"WELLNESS",benefits:["60-Minute Spa Treatment","Sauna Access","Welcome Drink"]},
  {id:"business",title:"Business Stay",category:"Business Travel",description:"Designed for the modern professional.",price:140000,image:IMG("photo-1497366811353-6870744d04b2"),badge:"BUSINESS",benefits:["High-Speed Wi-Fi","Meeting Room Access","Airport Pickup Optional"]},
  {id:"long",title:"Extended Comfort",category:"Long Stay",description:"The longer you stay, the more you save.",price:0,image:IMG("photo-1566665797739-1674de7a421a"),badge:"LONG STAY",benefits:["Save up to 25%","Weekly Housekeeping","Flexible Dates"]},
  {id:"season",title:"Season of Elegance",category:"Seasonal",description:"Celebrate the season with special rates and added benefits.",price:110000,image:IMG("photo-1564501049412-61c2a3083791"),badge:"SEASONAL",benefits:["Special Rate","Breakfast","Pool & Spa Access"]},
  {id:"honeymoon",title:"Honeymoon Bliss",category:"Seasonal",description:"A romantic escape for newlyweds.",price:150000,image:IMG("photo-1596394516093-501ba68a0ba6"),badge:"HONEYMOON",benefits:["Romantic Setup","Breakfast","Welcome Champagne"]},
  {id:"family",title:"Family Getaway",category:"Room Packages",description:"Create lasting memories with your loved ones.",price:130000,image:IMG("photo-1602002418082-a4443e081dd1"),badge:"FAMILY",benefits:["Family Room","Breakfast","Pool Access"]}
 ],
 gallery:[
  ["Lobby","Hotel Interior","photo-1566073771259-6a8506099945"],["Superior Room","Rooms","photo-1611892440504-42a792e24d32"],["Infinity Pool","Amenities","photo-1540541338287-41700207dee6"],["Fine Dining","Dining","photo-1517248135467-4c7edcad34c4"],["Conference Hall","Meetings & Conferences","photo-1497366754035-f200968a6e72"],["Spa & Wellness","Amenities","photo-1540555700478-4be289fbecef"],["Rooftop Lounge","Outdoor Spaces","photo-1519167758481-83f550bb49b3"],["Exterior View","Hotel Interior","photo-1564501049412-61c2a3083791"],["Gym & Fitness","Amenities","photo-1534438327276-14e5300c3a48"],["Presidential Room","Rooms","photo-1590490360182-c33d57733427"],["Private Dining","Dining","photo-1515003197210-e0cd71810b5f"],["Our People","Our People","photo-1516321318423-f06f85e504b3"]
 ].map(([title,category,id],i)=>({id:`gallery-${i}`,title,category,image:IMG(id)})),
 events:[
  {id:"wine-dinner",slug:"an-evening-of-fine-wines",title:"An Evening of Fine Wines",category:"Wine Dinner",date:"2026-10-18",time:"7:00 PM – 10:00 PM",venue:"THELUSO Hotel",description:"A curated five-course menu paired with premium wines from around the world.",details:"Join us for an intimate five-course dinner, guided wine pairings and an evening of exceptional hospitality.",image:IMG("photo-1510812431401-41d2bd2722f3")},
  {id:"jazz",slug:"jazz-under-the-stars",title:"Jazz Under the Stars",category:"Live Music",date:"2026-10-24",time:"8:00 PM – 11:00 PM",venue:"THELUSO Lounge",description:"An unforgettable night of live jazz, great food, and timeless vibes.",details:"Live musicians, crafted cocktails and a skyline setting make this a signature THELUSO evening.",image:IMG("photo-1514525253161-7a46d19cd819")},
  {id:"summit",slug:"business-growth-summit",title:"Business Growth Summit",category:"Conferences",date:"2026-11-03",time:"9:00 AM – 5:00 PM",venue:"THELUSO Conference Hall",description:"Join industry leaders for a day of insights, networking, and opportunities.",details:"A full-day business conference with keynote sessions, networking and premium hospitality.",image:IMG("photo-1505373877841-8d25f7d46678")},
  {id:"christmas",slug:"christmas-eve-celebration",title:"Christmas Eve Celebration",category:"Seasonal Events",date:"2026-12-24",time:"6:00 PM – 11:00 PM",venue:"THELUSO Grand Ballroom",description:"A magical evening with fine dining, live music, and festive surprises.",details:"Celebrate Christmas Eve with a gala dinner, live entertainment and an unforgettable THELUSO atmosphere.",image:IMG("photo-1482517967863-00e15c9b44be")}
 ],
 amenities:[
  ["Infinity Pool","Guest Services","Relax and unwind at our rooftop infinity pool with stunning views of Abuja.","photo-1540541338287-41700207dee6","pool"],["Fitness Center","Wellness & Fitness","State-of-the-art equipment to keep you active, anytime.","photo-1534438327276-14e5300c3a48","fitness"],["Spa & Wellness","Wellness & Fitness","Rejuvenate your body and mind with our range of therapies and treatments.","photo-1540555700478-4be289fbecef","spa"],["Conference & Events","Business & Events","Fully equipped meeting rooms and event spaces for business and private gatherings.","photo-1497366754035-f200968a6e72","events"],["Restaurants & Bar","Dining & Leisure","Enjoy exquisite cuisine and signature drinks in elegant settings.","photo-1517248135467-4c7edcad34c4","dining"],["Valet Parking","Convenience","Hassle-free parking with professional valet service.","photo-1503376780353-7e6692767b70","car"],["Airport Transfers","Convenience","Seamless airport pickup and drop-off services for your convenience.","photo-1549317661-bd32c8ce0db2","transfer"],["Complimentary Wi-Fi","Guest Services","Stay connected with high-speed internet throughout the hotel.","photo-1497366811353-6870744d04b2","wifi"]
 ].map(([title,category,description,image,icon],i)=>({id:`amenity-${i}`,title,category,description,image:IMG(image),icon}))
 , dining:[], home:{}, contact:{}
};

export async function getHotelContent(slug:string):Promise<HotelContent>{
 const store=await prisma.store.findUnique({where:{slug},select:{id:true}}); if(!store)return defaults;
 const [pages,services]=await Promise.all([prisma.storePage.findMany({where:{storeId:store.id,slug:{in:["hotel-home","hotel-rooms","hotel-offers","hotel-gallery","hotel-events","hotel-amenities","hotel-contact"]}}}),prisma.service.findMany({where:{storeId:store.id,isPublished:true},select:{id:true,name:true,images:true,price:true,attributes:true}})]);
 const map=new Map(pages.map(p=>[p.slug,p.content as any]));
 return {
  rooms: map.get("hotel-rooms")?.rooms ?? defaults.rooms,
  offers: map.get("hotel-offers")?.offers ?? defaults.offers,
  gallery: map.get("hotel-gallery")?.items ?? defaults.gallery,
  events: map.get("hotel-events")?.events ?? defaults.events,
  amenities: map.get("hotel-amenities")?.amenities ?? defaults.amenities,
  dining: map.get("hotel-home")?.dining ?? defaults.dining,
  home: map.get("hotel-home")?.home ?? defaults.home,
  contact: map.get("hotel-contact")?.contact ?? defaults.contact,
  ...( { _serviceMap: Object.fromEntries(services.map(s=>{ const a=(s.attributes as any)||{}; return [a.hotelRoomId||s.name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),s.id]; })) } as any),
 };
}

export { defaults as DEFAULT_HOTEL_CONTENT };
