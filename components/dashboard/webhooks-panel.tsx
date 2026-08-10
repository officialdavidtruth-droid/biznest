"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { WebhookEndpoint, WebhookDelivery, WebhookEventType } from "@prisma/client";
import {
  createWebhookEndpoint,
  updateWebhookEndpoint,
  rotateWebhookSecret,
  deleteWebhookEndpoint,
  retryWebhookDelivery,
} from "@/lib/actions/webhook";

type EventOption = { type: WebhookEventType; name: string };

export function WebhooksPanel({
  slug,
  endpoints,
  eventOptions,
}: {
  slug: string;
  endpoints: WebhookEndpoint[];
  eventOptions: EventOption[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([]);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});

  function toggleEvent(type: WebhookEventType) {
    setSelectedEvents((prev) => (prev.includes(type) ? prev.filter((e) => e !== type) : [...prev, type]));
  }

  async function handleCreate() {
    if (!url.trim()) return toast.error("Enter an endpoint URL.");
    setCreating(true);
    const result = await createWebhookEndpoint(slug, url.trim(), selectedEvents);
    setCreating(false);
    if (!result.success) return toast.error(result.error);
    setNewSecret(result.data.secret);
    setUrl("");
    setSelectedEvents([]);
    router.refresh();
  }

  async function handleToggleActive(endpoint: WebhookEndpoint) {
    const result = await updateWebhookEndpoint(slug, endpoint.id, { isActive: !endpoint.isActive });
    if (!result.success) return toast.error(result.error);
    router.refresh();
  }

  async function handleRotate(endpointId: string) {
    const result = await rotateWebhookSecret(slug, endpointId);
    if (!result.success) return toast.error(result.error);
    setNewSecret(result.data.secret);
  }

  async function handleDelete(endpointId: string) {
    if (!confirm("Delete this webhook endpoint? This can't be undone.")) return;
    const result = await deleteWebhookEndpoint(slug, endpointId);
    if (!result.success) return toast.error(result.error);
    toast.success("Webhook endpoint deleted.");
    router.refresh();
  }

  async function loadDeliveries(endpointId: string) {
    if (expanded === endpointId) {
      setExpanded(null);
      return;
    }
    setExpanded(endpointId);
    if (!deliveries[endpointId]) {
      const { listWebhookDeliveries } = await import("@/lib/actions/webhook");
      const rows = await listWebhookDeliveries(slug, endpointId);
      setDeliveries((prev) => ({ ...prev, [endpointId]: rows }));
    }
  }

  async function handleRetry(endpointId: string, deliveryId: string) {
    const result = await retryWebhookDelivery(slug, deliveryId);
    if (!result.success) return toast.error(result.error);
    toast.success("Retried.");
    const { listWebhookDeliveries } = await import("@/lib/actions/webhook");
    const rows = await listWebhookDeliveries(slug, endpointId);
    setDeliveries((prev) => ({ ...prev, [endpointId]: rows }));
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <h3 className="mb-1 text-sm font-semibold">Webhooks</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Get real-time HTTP POSTs when things happen in your store — order.created, payment.success,
        booking.confirmed, and more — instead of polling the API.
      </p>

      {newSecret && (
        <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs">
          <p className="mb-1 font-semibold">Signing secret (shown once — copy it now)</p>
          <code className="break-all">{newSecret}</code>
          <button className="ml-2 underline" onClick={() => setNewSecret(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 space-y-2 rounded-md border p-3">
        <p className="text-xs font-medium">Add an endpoint</p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks/biznest"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {eventOptions.map((opt) => (
            <label key={opt.type} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={selectedEvents.includes(opt.type)}
                onChange={() => toggleEvent(opt.type)}
              />
              {opt.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Leave all unchecked to receive every event type.</p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add endpoint"}
        </button>
      </div>

      <div className="space-y-2">
        {endpoints.length === 0 && <p className="text-xs text-muted-foreground">No webhook endpoints yet.</p>}
        {endpoints.map((endpoint) => (
          <div key={endpoint.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{endpoint.url}</p>
                <p className="text-xs text-muted-foreground">
                  {endpoint.events.length === 0 ? "All events" : endpoint.events.join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className={endpoint.isActive ? "text-green-600" : "text-muted-foreground"}>
                  {endpoint.isActive ? "Active" : "Paused"}
                </span>
                <button className="underline" onClick={() => handleToggleActive(endpoint)}>
                  {endpoint.isActive ? "Pause" : "Resume"}
                </button>
                <button className="underline" onClick={() => handleRotate(endpoint.id)}>
                  Rotate secret
                </button>
                <button className="underline" onClick={() => loadDeliveries(endpoint.id)}>
                  {expanded === endpoint.id ? "Hide log" : "Delivery log"}
                </button>
                <button className="text-red-600 underline" onClick={() => handleDelete(endpoint.id)}>
                  Delete
                </button>
              </div>
            </div>

            {expanded === endpoint.id && (
              <div className="mt-3 space-y-1 border-t pt-2">
                {(deliveries[endpoint.id] ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No deliveries yet.</p>
                )}
                {(deliveries[endpoint.id] ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-xs">
                    <span>
                      {d.eventType} — {d.status}
                      {d.lastStatusCode ? ` (HTTP ${d.lastStatusCode})` : ""} — {d.attemptCount} attempt(s)
                    </span>
                    {d.status !== "SUCCEEDED" && (
                      <button className="underline" onClick={() => handleRetry(endpoint.id, d.id)}>
                        Retry now
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
