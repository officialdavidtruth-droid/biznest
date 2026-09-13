"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, Save, Image as ImageIcon, CalendarDays, Tag, Sparkles } from "lucide-react";
import { saveHotelSection } from "@/lib/actions/hotel-content";
import { SingleImageUpload } from "@/components/forms/single-image-upload";
import {
  HOTEL_GALLERY_CATEGORIES,
  HOTEL_OFFER_CATEGORIES,
  HOTEL_AMENITY_CATEGORIES,
  type HotelContent,
  type HotelOffer,
  type HotelGalleryItem,
  type HotelEvent,
  type HotelAmenity,
} from "@/lib/hotel-content";

type Tab = "gallery" | "amenities" | "events" | "offers";

export function HotelContentManager({ slug, initial }: { slug: string; initial: HotelContent }) {
  const [tab, setTab] = useState<Tab>("gallery");
  const [gallery, setGallery] = useState<HotelGalleryItem[]>(initial.gallery);
  const [amenities, setAmenities] = useState<HotelAmenity[]>(initial.amenities);
  const [events, setEvents] = useState<HotelEvent[]>(initial.events);
  const [offers, setOffers] = useState<HotelOffer[]>(initial.offers);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState("");

  const sections: [Tab, string, React.ReactNode][] = [
    ["gallery", "Gallery", <ImageIcon key="i" className="mr-2 inline h-4 w-4" />],
    ["amenities", "Amenities", <Sparkles key="i" className="mr-2 inline h-4 w-4" />],
    ["events", "Events", <CalendarDays key="i" className="mr-2 inline h-4 w-4" />],
    ["offers", "Offers", <Tag key="i" className="mr-2 inline h-4 w-4" />],
  ];

  function save() {
    start(async () => {
      setMsg("");
      const payload: Record<Tab, unknown> =
        tab === "gallery"
          ? { items: gallery }
          : tab === "amenities"
          ? { amenities }
          : tab === "events"
          ? { events }
          : { offers };
      const section = `hotel-${tab}` as const;
      const r = await saveHotelSection(slug, section, payload[tab]);
      setMsg(r.success ? "Published successfully." : r.error || "Could not save.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hotel Website Content</h1>
          <p className="text-sm text-muted-foreground">
            Manage the Gallery, Amenities, Events and Offers shown on your storefront. Rooms come directly from{" "}
            <a className="underline" href={`/store/${slug}/admin/services`}>
              Manage Rooms &amp; Services
            </a>{" "}
            — add or edit a room there and it appears on your site automatically.
          </p>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {busy ? "Publishing…" : "Publish Changes"}
        </button>
      </div>
      {msg && <p className="rounded-lg border bg-muted/40 p-3 text-sm">{msg}</p>}
      <div className="flex flex-wrap gap-2 border-b">
        {sections.map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-semibold ${tab === key ? "border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === "gallery" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() =>
                setGallery((xs) => [
                  ...xs,
                  { id: crypto.randomUUID(), title: "New Photo", category: "Hotel Interior", image: "", description: "" },
                ])
              }
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Photo
            </button>
          </div>
          {gallery.map((g) => (
            <article key={g.id} className="rounded-2xl border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-[176px_1fr]">
                <SingleImageUpload
                  value={g.image}
                  onChange={(url) => setGallery((xs) => xs.map((x) => (x.id === g.id ? { ...x, image: url } : x)))}
                  label="Upload photo"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Title">
                    <input value={g.title} onChange={(e) => setGallery((xs) => xs.map((x) => (x.id === g.id ? { ...x, title: e.target.value } : x)))} />
                  </Field>
                  <Field label="Category">
                    <select value={g.category} onChange={(e) => setGallery((xs) => xs.map((x) => (x.id === g.id ? { ...x, category: e.target.value } : x)))}>
                      {HOTEL_GALLERY_CATEGORIES.filter((c) => c !== "All").map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description">
                    <input
                      value={g.description || ""}
                      onChange={(e) => setGallery((xs) => xs.map((x) => (x.id === g.id ? { ...x, description: e.target.value } : x)))}
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => setGallery((xs) => xs.filter((x) => x.id !== g.id))} className="inline-flex items-center gap-1 text-sm text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "amenities" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() =>
                setAmenities((xs) => [
                  ...xs,
                  { id: crypto.randomUUID(), title: "New Amenity", category: "Guest Services", description: "", image: "", icon: "sparkles" },
                ])
              }
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Amenity
            </button>
          </div>
          {amenities.map((a) => (
            <article key={a.id} className="rounded-2xl border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-[176px_1fr]">
                <SingleImageUpload
                  value={a.image}
                  onChange={(url) => setAmenities((xs) => xs.map((x) => (x.id === a.id ? { ...x, image: url } : x)))}
                  label="Upload photo"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Title">
                    <input value={a.title} onChange={(e) => setAmenities((xs) => xs.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)))} />
                  </Field>
                  <Field label="Category">
                    <select value={a.category} onChange={(e) => setAmenities((xs) => xs.map((x) => (x.id === a.id ? { ...x, category: e.target.value } : x)))}>
                      {HOTEL_AMENITY_CATEGORIES.filter((c) => c !== "All Amenities").map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description">
                    <textarea
                      value={a.description}
                      onChange={(e) => setAmenities((xs) => xs.map((x) => (x.id === a.id ? { ...x, description: e.target.value } : x)))}
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => setAmenities((xs) => xs.filter((x) => x.id !== a.id))} className="inline-flex items-center gap-1 text-sm text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "events" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() =>
                setEvents((xs) => [
                  ...xs,
                  {
                    id: crypto.randomUUID(),
                    slug: `new-event-${xs.length + 1}`,
                    title: "New Event",
                    category: "Live Music",
                    date: "2026-11-01",
                    time: "7:00 PM – 10:00 PM",
                    venue: "",
                    description: "",
                    details: "",
                    image: "",
                  },
                ])
              }
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Event
            </button>
          </div>
          {events.map((ev) => (
            <article key={ev.id} className="rounded-2xl border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-[176px_1fr]">
                <SingleImageUpload
                  value={ev.image}
                  onChange={(url) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, image: url } : x)))}
                  label="Upload photo"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Event title">
                    <input value={ev.title} onChange={(e) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, title: e.target.value } : x)))} />
                  </Field>
                  <Field label="Category">
                    <input value={ev.category} onChange={(e) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, category: e.target.value } : x)))} />
                  </Field>
                  <Field label="Date">
                    <input type="date" value={ev.date} onChange={(e) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, date: e.target.value } : x)))} />
                  </Field>
                  <Field label="Time">
                    <input value={ev.time} onChange={(e) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, time: e.target.value } : x)))} />
                  </Field>
                  <Field label="Venue">
                    <input value={ev.venue} onChange={(e) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, venue: e.target.value } : x)))} />
                  </Field>
                  <Field label="Short description">
                    <textarea
                      value={ev.description}
                      onChange={(e) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, description: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Full details">
                    <textarea value={ev.details} onChange={(e) => setEvents((xs) => xs.map((x) => (x.id === ev.id ? { ...x, details: e.target.value } : x)))} />
                  </Field>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => setEvents((xs) => xs.filter((x) => x.id !== ev.id))} className="inline-flex items-center gap-1 text-sm text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "offers" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() =>
                setOffers((xs) => [
                  ...xs,
                  { id: crypto.randomUUID(), title: "New Offer", category: "Room Packages", description: "", price: 0, image: "", badge: "", benefits: [] },
                ])
              }
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Offer
            </button>
          </div>
          {offers.map((o) => (
            <article key={o.id} className="rounded-2xl border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-[176px_1fr]">
                <SingleImageUpload
                  value={o.image}
                  onChange={(url) => setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, image: url } : x)))}
                  label="Upload photo"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Title">
                    <input value={o.title} onChange={(e) => setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, title: e.target.value } : x)))} />
                  </Field>
                  <Field label="Category">
                    <select value={o.category} onChange={(e) => setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, category: e.target.value } : x)))}>
                      {HOTEL_OFFER_CATEGORIES.filter((c) => c !== "All Offers").map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Badge">
                    <input value={o.badge} onChange={(e) => setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, badge: e.target.value } : x)))} />
                  </Field>
                  <Field label="Price (₦, 0 = no fixed price)">
                    <input
                      type="number"
                      value={o.price}
                      onChange={(e) => setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, price: Number(e.target.value) } : x)))}
                    />
                  </Field>
                  <Field label="Description">
                    <textarea value={o.description} onChange={(e) => setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, description: e.target.value } : x)))} />
                  </Field>
                  <Field label="Benefits (one per line)">
                    <textarea
                      value={o.benefits.join("\n")}
                      onChange={(e) =>
                        setOffers((xs) => xs.map((x) => (x.id === o.id ? { ...x, benefits: e.target.value.split("\n").filter(Boolean) } : x)))
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => setOffers((xs) => xs.filter((x) => x.id !== o.id))} className="inline-flex items-center gap-1 text-sm text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="[&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_select]:py-2 [&_textarea]:min-h-20 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2">
        {children}
      </div>
    </label>
  );
}