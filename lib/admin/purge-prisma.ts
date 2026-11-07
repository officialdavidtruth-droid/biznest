import { Prisma } from "@prisma/client";
import { buildPurgePlan, purgeRows, type FkEdge, type PurgeDb, type PurgeResult } from "@/lib/admin/purge";

type Tx = Prisma.TransactionClient;

const ident = (name: string) => Prisma.raw(`"${name.replace(/"/g, '""')}"`);

function prismaDb(tx: Tx): PurgeDb {
  return {
    async selectIds(table, col, values) {
      const rows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT "id" FROM ${ident(table)} WHERE ${ident(col)} IN (${Prisma.join(values)})`,
      );
      return rows.map((r) => r.id);
    },
    async deleteWhere(table, col, values) {
      return tx.$executeRaw(Prisma.sql`DELETE FROM ${ident(table)} WHERE ${ident(col)} IN (${Prisma.join(values)})`);
    },
  };
}

/** Reads every single-column foreign key in the current schema, plus which tables have an "id" column. */
async function loadSchema(tx: Tx) {
  const edges = await tx.$queryRaw<FkEdge[]>`
    SELECT cc.relname AS "child", ca.attname AS "childCol",
           pc.relname AS "parent", pa.attname AS "parentCol",
           c.confdeltype::text AS "action"
    FROM pg_constraint c
    JOIN pg_class cc ON cc.oid = c.conrelid
    JOIN pg_class pc ON pc.oid = c.confrelid
    JOIN pg_attribute ca ON ca.attrelid = c.conrelid AND ca.attnum = c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND cardinality(c.conkey) = 1
      AND cc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())`;
  const idTables = await tx.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = 'id'`;
  return { edges, tablesWithId: idTables.map((t) => t.table_name) };
}

/**
 * Permanently deletes rows of `table` (by "id") together with every record that would block the delete.
 * Run it inside a transaction so a failure part-way leaves nothing half-deleted.
 */
export async function purgeWithDependents(
  tx: Tx,
  table: string,
  ids: string[],
  alsoDelete: string[] = [],
): Promise<PurgeResult> {
  const { edges, tablesWithId } = await loadSchema(tx);
  const plan = buildPurgePlan(edges, tablesWithId, alsoDelete);
  return purgeRows(prismaDb(tx), plan, table, ids);
}
