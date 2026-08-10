// Shared across every checkout theme (see app/store/[slug]/checkout/*-checkout-client.tsx)
// so a merchant's city grouping ("Abuja: Gwarinpa, Wuse, Maitama…") shows up the
// same way no matter which storefront template they're using.
//
// Zones with a `city` are grouped under an <optgroup>; zones with no city (the
// common case for single-area merchants) render as plain top-level <option>s so
// nothing changes visually for stores that haven't adopted city grouping.

export type DeliveryZoneOption = {
  id: string;
  name: string;
  city: string | null;
  fee: unknown;
  estimatedMinutes: number | null;
};

function optionLabel(z: DeliveryZoneOption) {
  return `${z.name} — ${Number(z.fee).toLocaleString()}${z.estimatedMinutes ? ` (~${z.estimatedMinutes} min)` : ""}`;
}

export function DeliveryZoneOptions({ zones }: { zones: DeliveryZoneOption[] }) {
  const grouped: { city: string | null; zones: DeliveryZoneOption[] }[] = [];
  for (const z of zones) {
    const bucket = grouped.find((g) => g.city === z.city);
    if (bucket) bucket.zones.push(z);
    else grouped.push({ city: z.city, zones: [z] });
  }

  return (
    <>
      {grouped.map((g) =>
        g.city ? (
          <optgroup key={g.city} label={g.city}>
            {g.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {optionLabel(z)}
              </option>
            ))}
          </optgroup>
        ) : (
          g.zones.map((z) => (
            <option key={z.id} value={z.id}>
              {optionLabel(z)}
            </option>
          ))
        )
      )}
    </>
  );
}
