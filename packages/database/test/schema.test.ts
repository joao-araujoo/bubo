import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { schema } from '../src';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

/** Parses `CREATE TABLE "name" ( "col" ... )` blocks into table → column names. */
function parseMigrationTables(sql: string): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)" \(([\s\S]*?)\n\);/g)) {
    const [, name, body] = match;
    if (!name || !body) continue;
    const columns = [...body.matchAll(/^\s*"(\w+)"/gm)].map((m) => m[1] ?? '');
    tables.set(name, columns);
  }
  // Later migrations may add columns with `ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "c" ...`.
  for (const match of sql.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN IF NOT EXISTS "(\w+)"/g)) {
    const [, name, column] = match;
    if (!name || !column) continue;
    const columns = tables.get(name);
    if (!columns) throw new Error(`ALTER TABLE on unknown table ${name}`);
    if (!columns.includes(column)) columns.push(column);
  }
  return tables;
}

const drizzleTables = Object.values(schema) as PgTable[];

describe('database schema', () => {
  it('names migrations with a 4-digit sequence starting at 0001', () => {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(files[0]).toBe('0001_foundation.sql');
    files.forEach((file, index) =>
      expect(file.startsWith(String(index + 1).padStart(4, '0'))).toBe(true),
    );
  });

  it('keeps the Drizzle schema and the SQL migrations in sync', () => {
    const sql = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
      .join('\n');
    const migrated = parseMigrationTables(sql);

    const expected = new Map(
      drizzleTables.map((table) => {
        const config = getTableConfig(table);
        return [config.name, config.columns.map((c) => c.name).sort()];
      }),
    );

    expect([...migrated.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [name, columns] of expected) {
      expect(migrated.get(name)?.slice().sort(), `columns of ${name}`).toEqual(columns);
    }
  });

  it('uses plural table names for the Better Auth adapter', () => {
    const names = drizzleTables.map((t) => getTableConfig(t).name);
    expect(names).toEqual(
      expect.arrayContaining(['accounts', 'sessions', 'users', 'verifications']),
    );
  });

  it('exports every table with a plural key matching Better Auth models', () => {
    expect(Object.keys(schema).sort()).toEqual([
      'accounts',
      'books',
      'clubCycleMembers',
      'clubCycles',
      'clubMembers',
      'clubPollArguments',
      'clubPollOptions',
      'clubPollVotes',
      'clubPolls',
      'clubPosts',
      'clubReactions',
      'clubReplies',
      'clubs',
      'contentReports',
      'friendships',
      'rateLimits',
      'readerProfiles',
      'readingSessions',
      'recallCards',
      'reviewLogs',
      'sessions',
      'shelfEntries',
      'socialPreferences',
      'userBlocks',
      'users',
      'verifications',
    ]);
  });
});
