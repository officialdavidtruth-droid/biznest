import { prisma } from "@/lib/prisma";

export const EXAMPLE_TEMPLATE_NAME = "Example — Modern Electronics Store";

export type ExampleContent = {
  heroEyebrow: string; heroTitle: string; heroAccent: string; heroSubtitle: string; heroImage: string;
  promoOneTitle: string; promoOneText: string; promoOneImage: string;
  promoTwoTitle: string; promoTwoText: string; promoTwoImage: string;
  audioTitle: string; audioImage: string; cameraTitle: string; cameraImage: string;
  newsletterTitle: string; newsletterText: string; footerTagline: string;
  trustOneTitle: string; trustOneText: string; trustTwoTitle: string; trustTwoText: string;
  trustThreeTitle: string; trustThreeText: string; trustFourTitle: string; trustFourText: string;
  promoOneHref?: string; promoTwoHref?: string; audioHref?: string; cameraHref?: string;
};

export const DEFAULT_EXAMPLE_CONTENT: ExampleContent = {
  heroEyebrow: "NEW LAUNCH",
  heroTitle: "Future Technology",
  heroAccent: "Today.",
  heroSubtitle: "Explore the latest smart devices and innovations.",
  heroImage: "",
  promoOneTitle: "Featured Product",
  promoOneText: "Add your featured product details here.",
  promoOneImage: "",
  promoTwoTitle: "Featured Offer",
  promoTwoText: "Create an offer from your BizNest dashboard.",
  promoTwoImage: "",
  audioTitle: "Featured Collection", audioImage: "",
  cameraTitle: "Explore Our Products", cameraImage: "",
  newsletterTitle: "Stay Connected",
  newsletterText: "Get exclusive offers, new arrivals and discounts straight to your inbox.",
  footerTagline: "A storefront powered by BizNest.",
  trustOneTitle: "Secure Payment", trustOneText: "Handled by the business's configured gateway.",
  trustTwoTitle: "Delivery Options", trustTwoText: "Available options are shown at checkout.",
  trustThreeTitle: "Returns", trustThreeText: "See the business's published return policy.",
  trustFourTitle: "Customer Support", trustFourText: "Contact the business for assistance.",
};

export async function getExampleContent(slug: string): Promise<ExampleContent> {
  const store = await prisma.store.findUnique({ where: { slug }, select: { sectionOverrides: true } });
  const root = (store?.sectionOverrides as Record<string, unknown> | null) ?? {};
  const saved = (root.exampleContent as Partial<ExampleContent> | undefined) ?? {};
  return { ...DEFAULT_EXAMPLE_CONTENT, ...saved };
}