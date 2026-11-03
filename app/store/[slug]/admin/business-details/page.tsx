// Route: /store/[slug]/admin/business-details
// Set your business facts once. Every template's top and bottom of the website reads them from here.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { saveBusinessDetails, BUSINESS_DETAILS_LIMITS as L } from "@/lib/actions/business-details";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";
import { BusinessLogoField } from "@/components/dashboard/business-logo-field";

const input = "w-full rounded-md border px-3 py-2 text-sm";
const label = "mb-1 block text-xs text-muted-foreground";

export default async function BusinessDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) {
    return <div className="bn-admin-page"><p className="text-sm text-muted-foreground">{access.error}</p></div>;
  }
  const store = await prisma.store.findUnique({ where: { id: access.store.id }, include: { business: { select: { city: true, state: true } } } });
  if (!store) notFound();

  const social = (store.socialLinks && typeof store.socialLinks === "object" && !Array.isArray(store.socialLinks) ? store.socialLinks : {}) as Record<string, string | undefined>;
  const save = async (formData: FormData) => {
    "use server";
    return saveBusinessDetails(slug, formData);
  };
  const guess = [store.business?.city, store.business?.state].filter(Boolean).join(", ");

  return (
    <div className="bn-admin-page max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Your business details</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill these in once. They appear automatically at the top and bottom of every page of your website, whichever design you choose.
        </p>
      </div>

      <StoreSettingsForm action={save}>
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Your business</p>
          <label className={label}>Business name</label>
          <input name="name" required maxLength={L.name} defaultValue={store.name} className={`${input} mb-4`} />
          <BusinessLogoField initialLogo={store.logoUrl ?? ""} />
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">How customers reach you</p>
          <label className={label}>Phone number</label>
          <input name="phone" inputMode="tel" maxLength={L.phone} defaultValue={store.contactPhone ?? ""} placeholder="0803 123 4567" className={`${input} mb-3`} />
          <label className={label}>WhatsApp number</label>
          <input name="whatsapp" inputMode="tel" defaultValue={social.whatsapp ?? ""} placeholder="0803 123 4567 or +234 803 123 4567" className={`${input} mb-3`} />
          <label className={label}>Email</label>
          <input name="email" type="email" maxLength={L.email} defaultValue={store.contactEmail ?? ""} placeholder="hello@yourbusiness.com" className={input} />
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Where to find you</p>
          <label className={label}>Address</label>
          <textarea name="address" rows={2} maxLength={L.address} defaultValue={store.address ?? ""} placeholder={guess ? `e.g. 12 Market Road, ${guess}` : "Street, area and city"} className={`${input} mb-3`} />
          <label className={label}>Opening hours</label>
          <input name="openingHours" maxLength={L.openingHours} defaultValue={store.openingHours ?? ""} placeholder="Mon–Sat, 9am–6pm" className={input} />
        </div>

        <div className="rounded-lg border bg-background p-4">
          <p className="mb-1 text-sm font-medium">Social media</p>
          <p className="mb-3 text-xs text-muted-foreground">Paste a link or just your name (like @yourbusiness). Leave blank to hide it.</p>
          {([
            ["instagram", "Instagram"],
            ["facebook", "Facebook"],
            ["tiktok", "TikTok"],
            ["twitter", "X (Twitter)"],
          ] as const).map(([key, title]) => (
            <div key={key} className="mb-3 last:mb-0">
              <label className={label}>{title}</label>
              <input name={key} defaultValue={social[key] ?? ""} placeholder="@yourbusiness" className={input} />
            </div>
          ))}
        </div>
      </StoreSettingsForm>
    </div>
  );
}
