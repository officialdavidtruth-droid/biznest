import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { WebhookEventType } from "@prisma/client";
import { WEBHOOK_EVENT_NAMES } from "@/lib/webhooks/events";

const MAX_ATTEMPTS = 8;
const REQUEST_TIMEOUT_MS = 10_000;
const RESPONSE_SNIPPET_LEN = 500;

// Exponential backoff, capped at 6h between tries: 1m, 5m, 30m, 1h, 2h, 4h,
// 6h, 6h. Good enough to ride out a subscriber's short outage or deploy
// without hammering them, while still giving up (marking FAILED) within
// about a day if they never come back.
const BACKOFF_SCHEDULE_MINUTES = [1, 5, 30, 60, 120, 240, 360, 360];

function signPayload(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Fires a webhook event to every active endpoint (store-scoped, plus any
 * platform-level endpoints with storeId: null) subscribed to it. Creates a
 * WebhookDelivery row per endpoint and attempts immediate delivery inline —
 * this runs after the triggering DB write has committed, so a slow or dead
 * subscriber URL never blocks the user-facing action itself. Callers should
 * NOT await this if the response time to the user matters; fire it and let
 * it resolve in the background (Next.js keeps the request alive for
 * in-flight work started before the response is sent in a Server Action /
 * Route Handler).
 *
 * storeId is required for store-scoped events (all current event types
 * are) so we know which store's endpoints — plus any platform-wide ones —
 * should receive it.
 */
export async function emitWebhookEvent(
  eventType: WebhookEventType,
  storeId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      isActive: true,
      OR: [{ storeId }, { storeId: null }],
    },
  });

  const subscribed = endpoints.filter(
    (e) => e.events.length === 0 || e.events.includes(eventType)
  );
  if (subscribed.length === 0) return;

  const body = {
    event: WEBHOOK_EVENT_NAMES[eventType],
    createdAt: new Date().toISOString(),
    data: payload,
  };

  await Promise.all(
    subscribed.map(async (endpoint) => {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          eventType,
          payload: body as Prisma.InputJsonValue,
        },
      });
      await attemptDelivery(delivery.id);
    })
  );
}

/**
 * Same as emitWebhookEvent, but for events that aren't tied to any one
 * store (e.g. customer.created — a platform-wide signup) — only delivers
 * to platform-level endpoints (storeId: null), since a store-scoped
 * endpoint has no way to filter to "customers relevant to my store"
 * anyway.
 */
export async function emitPlatformWebhookEvent(
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { isActive: true, storeId: null },
  });
  const subscribed = endpoints.filter(
    (e) => e.events.length === 0 || e.events.includes(eventType)
  );
  if (subscribed.length === 0) return;

  const body = { event: WEBHOOK_EVENT_NAMES[eventType], createdAt: new Date().toISOString(), data: payload };

  await Promise.all(
    subscribed.map(async (endpoint) => {
      const delivery = await prisma.webhookDelivery.create({
        data: { endpointId: endpoint.id, eventType, payload: body as Prisma.InputJsonValue },
      });
      await attemptDelivery(delivery.id);
    })
  );
}

/**
 * Sends (or resends) one delivery attempt and updates the WebhookDelivery
 * row with the outcome. Used both for the first attempt from
 * emitWebhookEvent and for retries picked up by the cron sweep in
 * app/api/cron/webhooks/route.ts.
 */
export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || delivery.status === "SUCCEEDED") return;
  if (!delivery.endpoint.isActive) return;

  const rawBody = JSON.stringify(delivery.payload);
  const signature = signPayload(rawBody, delivery.endpoint.secret);
  const attemptCount = delivery.attemptCount + 1;

  let statusCode: number | null = null;
  let responseSnippet = "";
  let ok = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BizNest-Event": WEBHOOK_EVENT_NAMES[delivery.eventType],
        "X-BizNest-Delivery-Id": delivery.id,
        "X-BizNest-Signature": `sha256=${signature}`,
      },
      body: rawBody,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    statusCode = res.status;
    responseSnippet = (await res.text()).slice(0, RESPONSE_SNIPPET_LEN);
    ok = res.ok;
  } catch (err) {
    responseSnippet = err instanceof Error ? err.message : "Request failed";
  }

  const exhausted = attemptCount >= MAX_ATTEMPTS;
  const backoffMinutes =
    BACKOFF_SCHEDULE_MINUTES[Math.min(attemptCount - 1, BACKOFF_SCHEDULE_MINUTES.length - 1)];

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attemptCount,
      lastStatusCode: statusCode,
      lastResponse: responseSnippet,
      lastAttemptAt: new Date(),
      status: ok ? "SUCCEEDED" : exhausted ? "FAILED" : "PENDING",
      nextAttemptAt: ok || exhausted ? null : new Date(Date.now() + backoffMinutes * 60_000),
    },
  });
}

/** Re-sends a single delivery on demand (dashboard "retry" button), resetting its backoff. */
export async function redeliver(deliveryId: string): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "PENDING", nextAttemptAt: new Date() },
  });
  await attemptDelivery(deliveryId);
}
