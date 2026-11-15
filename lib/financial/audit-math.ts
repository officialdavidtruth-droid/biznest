/** Pure maths for audit counts, shared by the server actions and the screen. */
export type CountLine = { expectedQty: number; countedQty: number | null; unitCost: number };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Positive = shortage (system says more than was found); negative = surplus. */
export function lineVariance(l: CountLine) {
  if (l.countedQty === null) return { qty: 0, value: 0, counted: false };
  const qty = r2(l.expectedQty - l.countedQty);
  return { qty, value: r2(qty * l.unitCost), counted: true };
}

export function summariseCount(lines: CountLine[]) {
  let counted = 0, matched = 0, shortages = 0, surpluses = 0, shortageValue = 0, surplusValue = 0, expectedValue = 0;
  for (const l of lines) {
    expectedValue += l.expectedQty * l.unitCost;
    const v = lineVariance(l);
    if (!v.counted) continue;
    counted++;
    if (v.qty === 0) matched++;
    else if (v.qty > 0) { shortages++; shortageValue += v.value; }
    else { surpluses++; surplusValue += -v.value; }
  }
  const total = lines.length;
  return {
    total, counted, remaining: total - counted, matched, shortages, surpluses,
    shortageValue: r2(shortageValue), surplusValue: r2(surplusValue), netVariance: r2(shortageValue - surplusValue), expectedValue: r2(expectedValue),
    accuracyPct: counted ? r2((matched / counted) * 100) : 0,
    progressPct: total ? Math.round((counted / total) * 100) : 0,
  };
}

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const AUDIT_TYPES = ["STOCK", "CASH", "ASSETS", "GENERAL"] as const;
