import { prisma } from "@/lib/prisma";

export const EXAMPLE_TEMPLATE_NAME = "Example — Modern Electronics Store";

export type ExampleContent = {
  heroEyebrow: string; heroTitle: string; heroAccent: string; heroSubtitle: string; heroImage: string;
  promoOneTitle: string; promoOneText: string; promoOneImage: string;
  promoTwoTitle: string; promoTwoText: string; promoTwoImage: string;
  audioTitle: string; audioImage: string; cameraTitle: string; cameraImage: string;
  newsletterTitle: string; newsletterText: string; footerTagline: string;
};

export const DEFAULT_EXAMPLE_CONTENT: ExampleContent = {
  heroEyebrow: "NEW LAUNCH",
  heroTitle: "Future Technology",
  heroAccent: "Today.",
  heroSubtitle: "Explore the latest smart devices and innovations.",
  heroImage: "",
  promoOneTitle: "MacBook Air M2",
  promoOneText: "Supercharged by M2. From $1099.00",
  promoOneImage: "",
  promoTwoTitle: "Grab Up to 40% Off",
  promoTwoText: "On selected items",
  promoTwoImage: "",
  audioTitle: "Sound That Moves You.", audioImage: "",
  cameraTitle: "Capture Every Detail.", cameraImage: "",
  newsletterTitle: "Join Example Club",
  newsletterText: "Get exclusive offers, new arrivals and discounts straight to your inbox.",
  footerTagline: "Your one-stop destination for the latest tech products and gadgets. Quality you can trust.",
};

export async function getExampleContent(slug: string): Promise<ExampleContent> {
  const store = await prisma.store.findUnique({ where: { slug }, select: { sectionOverrides: true } });
  const root = (store?.sectionOverrides as Record<string, unknown> | null) ?? {};
  const saved = (root.exampleContent as Partial<ExampleContent> | undefined) ?? {};
  return { ...DEFAULT_EXAMPLE_CONTENT, ...saved };
}
