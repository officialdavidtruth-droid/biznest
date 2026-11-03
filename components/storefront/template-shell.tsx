import React from "react";
import { prisma } from "@/lib/prisma";
import type { TemplateTheme } from "@/lib/template-themes";
import { Footer, Header, Skinned } from "@/components/storefront/universal-section-pages";

/**
 * The template's own header and footer around any storefront page that has none of its own (product and service
 * detail). Same skin as the inner pages, so a shopper who clicks from the home page into an item stays in the template.
 */
export async function TemplateShell({store,slug,theme,children}:{store:any;slug:string;theme:TemplateTheme;children:React.ReactNode}){
 const [products,services]=await Promise.all([
  prisma.product.count({where:{storeId:store.id,isPublished:true}}),
  prisma.service.count({where:{storeId:store.id,isPublished:true}}),
 ]);
 // Header/Footer read only the counts of these lists to label the services/shop link.
 const navStore={...store,products:Array(Math.min(products,1)),services:Array(Math.min(services,1)),sellsProducts:store.sellsProducts??store.business?.sellsProducts??true};
 const accent=theme.accent;
 return <Skinned p={{store:navStore,theme} as any}><Header store={navStore} slug={slug} active="" accent={accent}/>{children}<Footer store={navStore} slug={slug} accent={accent}/></Skinned>
}
