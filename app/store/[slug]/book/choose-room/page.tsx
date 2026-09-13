import HotelPage from "../../hotel-page";
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <HotelPage slug={slug}/>}
