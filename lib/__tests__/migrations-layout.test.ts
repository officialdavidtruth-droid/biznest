import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `prisma migrate deploy` applies migration folders in plain byte-order of
 * their names. A folder that doesn't start with a 14-digit UTC timestamp
 * (e.g. "migration_2026...") sorts after every real migration and runs last
 * on a fresh database, and a loose .sql file in this directory is silently
 * ignored by Prisma (it never runs). Both have shipped before.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../prisma/migrations');
const entries = readdirSync(MIGRATIONS_DIR);

describe('prisma/migrations layout', () => {
  it('contains only migration_lock.toml and timestamped migration folders', () => {
    const unexpected = entries.filter(
      (name) => name !== 'migration_lock.toml' && !/^\d{14}_[a-z0-9_]+$/.test(name),
    );
    expect(unexpected).toEqual([]);
  });

  it('has a migration.sql inside every migration folder (and nothing loose at the top level)', () => {
    for (const name of entries.filter((n) => n !== 'migration_lock.toml')) {
      expect(statSync(path.join(MIGRATIONS_DIR, name)).isDirectory(), `${name} must be a folder`).toBe(true);
      expect(existsSync(path.join(MIGRATIONS_DIR, name, 'migration.sql')), `${name}/migration.sql missing`).toBe(true);
    }
  });

  it('uses real UTC timestamps', () => {
    for (const name of entries.filter((n) => /^\d{14}_/.test(n))) {
      const t = name.slice(0, 14);
      const iso = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`;
      expect(Number.isNaN(Date.parse(iso)), `${name} has an invalid timestamp`).toBe(false);
    }
  });
});
