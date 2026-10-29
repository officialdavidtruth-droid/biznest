import { sendOrderNotificationEmail, storeEmailBrand } from "@/lib/email/send";
import { sendPushToUser } from "@/lib/push/send";
import { storeUrl } from "@/lib/seo";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}

type Store = Parameters<typeof storeEmailBrand>[0] & {
  slug: string;
  customDomain?: string | null;
  customDomainStatus?: string | null;
};

/**
 * Tells a customer that the store replied to their review: a store-branded
 * email, plus a web push if they've turned on notifications for the store.
 *
 * Customers have no in-app notification inbox (the Notification table feeds
 * the merchant dashboard bell), so email + push are the only channels.
 * Best-effort by design -- the reply is already saved, so neither channel
 * failing may surface as an error to the seller.
 *
 * Kept out of lib/actions/reviews.ts because that file is "use server" and
 * would expose this as a client-callable endpoint.
 */
export async function notifyCustomerOfReviewReply(args: {
  store: Store;
  customer: { id: string; email: string | null; name: string | null };
  reply: string;
}): Promise<void> {
  const { store, customer, reply } = args;
  const link = storeUrl(store, "/account/reviews");
  const title = `${store.name} replied to your review`;
  const excerpt = reply.length > 140 ? `${reply.slice(0, 137)}…` : reply;

  if (customer.email && customer.email.includes("@")) {
    try {
      const greeting = customer.name?.trim() ? `Hi ${escapeHtml(customer.name.trim().split(/\s+/)[0])},` : "Hi,";
      await sendOrderNotificationEmail(
        customer.email,
        title,
        `${greeting}<br/><br/><b>${escapeHtml(store.name)}</b> replied to your review:<br/><br/>` +
          `<i>${escapeHtml(reply).replace(/\n/g, "<br/>")}</i><br/><br/>` +
          `<a href="${escapeHtml(link)}">View your reviews</a>`,
        storeEmailBrand(store)
      );
    } catch (err) {
      console.error("[reviews] reply email failed", err);
    }
  }

  try {
    // Store-relative url: the store's service worker resolves it against its own scope.
    await sendPushToUser(customer.id, { title, body: excerpt, url: "/account/reviews", tag: "review-reply" });
  } catch (err) {
    console.error("[reviews] reply push failed", err);
  }
}
