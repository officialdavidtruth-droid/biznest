import type { ReactNode } from "react";
import { getTemplateVariant } from "@/lib/template-variants";
export function TemplateVariantFrame({name,children}:{name:string|null|undefined;children:ReactNode}){
 const v=getTemplateVariant(name);
 return <div data-biznest-template-variant={v?.variant??1} data-biznest-template-family={v?.family??"default"} data-biznest-template-layout={v?.layout??"default"} className={v?`bn-template-variant bn-${v.family} bn-${v.layout}`:""}>{children}</div>;
}
