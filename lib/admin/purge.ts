/**
 * Generic "delete this row and everything that blocks its deletion".
 *
 * Why this exists: deleting a store or its owner failed whenever any table that references them was set to
 * Restrict (payouts, refund clawbacks, reviews, messages, disputes, orders...). The old code listed those tables
 * by hand, so every new table or feature quietly broke deletion again. This reads the foreign keys from the
 * database itself, so it keeps working as the schema grows.
 *
 * How: for the rows being deleted it finds every table that points at them. Rows in tables whose foreign key
 * would block the delete (NO ACTION / RESTRICT) are purged first, depth first. Tables that cascade are left to
 * the database, unless something below them would block the cascade, in which case they are purged explicitly
 * too. SET NULL / SET DEFAULT references are left alone, so unrelated records survive with the link cleared.
 */

export type FkEdge = {
  child: string;
  childCol: string;
  parent: string;
  parentCol: string;
  /** Postgres confdeltype: a NO ACTION, r RESTRICT, c CASCADE, n SET NULL, d SET DEFAULT */
  action: string;
};

/** Minimal database surface, so the walk can be tested without Postgres. */
export interface PurgeDb {
  /** Primary-key ("id") values of rows in `table` whose `col` is one of `values`. */
  selectIds(table: string, col: string, values: string[]): Promise<string[]>;
  /** Delete rows in `table` whose `col` is one of `values`. */
  deleteWhere(table: string, col: string, values: string[]): Promise<number>;
}

export type PurgePlan = {
  incoming: Map<string, FkEdge[]>;
  /** Tables that have dependents (directly, or through a cascade chain) which would block deleting their rows. */
  needsWalk: Set<string>;
  /** Tables with an "id" column. Others (join tables) can only be deleted by foreign key. */
  hasId: Set<string>;
};

const BLOCKING = new Set(["a", "r"]);

/**
 * `alsoDelete` lists "Table.column" references that would normally be cleared (SET NULL) but whose rows belong to
 * the thing being deleted and should go with it, such as a store's payments.
 */
export function buildPurgePlan(rawEdges: FkEdge[], tablesWithId: Iterable<string>, alsoDelete: string[] = []): PurgePlan {
  const follow = new Set(alsoDelete);
  const edges = rawEdges.map((e) =>
    (e.action === "n" || e.action === "d") && follow.has(`${e.child}.${e.childCol}`) ? { ...e, action: "r" } : e,
  );
  const incoming = new Map<string, FkEdge[]>();
  for (const e of edges) {
    const list = incoming.get(e.parent) ?? [];
    list.push(e);
    incoming.set(e.parent, list);
  }
  const needsWalk = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (needsWalk.has(e.parent)) continue;
      if (BLOCKING.has(e.action) || (e.action === "c" && needsWalk.has(e.child))) {
        needsWalk.add(e.parent);
        changed = true;
      }
    }
  }
  return { incoming, needsWalk, hasId: new Set(tablesWithId) };
}

export type PurgeResult = { deleted: Record<string, number> };

export async function purgeRows(
  db: PurgeDb,
  plan: PurgePlan,
  table: string,
  ids: string[],
  state: { seen: Map<string, Set<string>>; deleted: Record<string, number> } = { seen: new Map(), deleted: {} },
): Promise<PurgeResult> {
  const seen = state.seen.get(table) ?? new Set<string>();
  state.seen.set(table, seen);
  const fresh = ids.filter((id) => !seen.has(id));
  if (!fresh.length) return { deleted: state.deleted };
  for (const id of fresh) seen.add(id);

  for (const e of plan.incoming.get(table) ?? []) {
    // Only edges that point at the row's "id" are followed; anything else is left to the database.
    if (e.parentCol !== "id") continue;
    const mustWalk = BLOCKING.has(e.action) || (e.action === "c" && plan.needsWalk.has(e.child));
    if (!mustWalk) continue;
    if (!plan.hasId.has(e.child)) {
      state.deleted[e.child] = (state.deleted[e.child] ?? 0) + (await db.deleteWhere(e.child, e.childCol, fresh));
      continue;
    }
    const childIds = await db.selectIds(e.child, e.childCol, fresh);
    if (childIds.length) await purgeRows(db, plan, e.child, childIds, state);
  }

  state.deleted[table] = (state.deleted[table] ?? 0) + (await db.deleteWhere(table, "id", fresh));
  return { deleted: state.deleted };
}
