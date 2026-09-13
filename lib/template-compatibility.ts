import { TEMPLATE_NAME, HOTEL_TEMPLATE_NAME, TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME } from "./template-themes";
import type { BusinessModelInput, BusinessMode } from "./business-experience";
import { getBusinessExperience, resolveBusinessMode } from "./business-experience";
export type TemplateCandidate={name:string;category?:string|null};
export function getTemplateBusinessType(template:TemplateCandidate):string|null{if(template.name===TEMPLATE_NAME)return "Restaurant";if(template.name===TASTEHOUSE_TEMPLATE_NAME)return "Restaurant";if(template.name===EXAMPLE_TEMPLATE_NAME)return "Retail";if(template.name===HOTEL_TEMPLATE_NAME)return "Hotel";return null;}
export function getTemplateMode(template:TemplateCandidate):BusinessMode|"unknown"{if(template.name===HOTEL_TEMPLATE_NAME||/hotel|lodging/i.test(`${template.name} ${template.category}`))return "service";if(template.name===TEMPLATE_NAME||template.name===TASTEHOUSE_TEMPLATE_NAME||/restaurant|food/i.test(`${template.name} ${template.category}`))return "service";if(template.name===EXAMPLE_TEMPLATE_NAME)return "commerce";return "unknown";}
export function isTemplateCompatible(template:TemplateCandidate,category?:string|null,model?:BusinessModelInput):boolean{if(![TEMPLATE_NAME,HOTEL_TEMPLATE_NAME,TASTEHOUSE_TEMPLATE_NAME,EXAMPLE_TEMPLATE_NAME].includes(template.name))return false;if(!category)return true;const c=category.toLowerCase();if(template.name===HOTEL_TEMPLATE_NAME)return c.includes("hotel")||c.includes("lodging");if(template.name===EXAMPLE_TEMPLATE_NAME)return c.includes("retail")||c.includes("electronics")||c.includes("ecommerce")||c.includes("commerce")||c.includes("shop");return c.includes("restaurant")||c.includes("food");}

/**
 * Numeric ranking used to sort candidate templates for a business (higher is
 * a better match). Incompatible templates always score 0; among compatible
 * ones, a template whose mode (commerce/service) lines up with the
 * business's resolved mode scores higher.
 */
export function templateCompatibilityScore(template:TemplateCandidate,category?:string|null,model?:BusinessModelInput):number{
  if(!isTemplateCompatible(template,category,model))return 0;
  let score=10;
  const mode=resolveBusinessMode(category,model);
  const templateMode=getTemplateMode(template);
  if(templateMode!=="unknown"&&(mode===templateMode||mode==="hybrid"))score+=5;
  return score;
}