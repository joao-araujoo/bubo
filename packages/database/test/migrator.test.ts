import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations, loadMigrations } from '../src/node';

let pg: PGlite;
const client = () => ({
  exec: (sql: string) => pg.exec(sql),
  query: (sql: string, params?: unknown[]) => pg.query(sql, params),
});

beforeEach(async () => {
  pg = new PGlite();
  await pg.waitReady;
});
afterEach(async () => {
  await pg.close();
});

async function insertUser(id = 'u1') {
  await pg.query(`INSERT INTO "users" ("id", "name", "email") VALUES ($1, 'Ana', $2)`, [
    id,
    `${id}@example.test`,
  ]);
}

describe('applyMigrations (PGlite)', () => {
  it('applies every migration once and is idempotent', async () => {
    const migrations = loadMigrations();
    expect(await applyMigrations(client(), migrations)).toEqual(migrations.map((m) => m.name));
    expect(await applyMigrations(client(), migrations)).toEqual([]);
    const { rows } = await pg.query<{ name: string }>(
      'SELECT "name" FROM "_bubo_migrations" ORDER BY 1',
    );
    expect(rows.map((r) => r.name)).toEqual([
      '0001_foundation.sql',
      '0002_onboarding.sql',
      '0003_auth_rate_limits.sql',
      '0004_reading_sessions.sql',
      '0005_recall.sql',
      '0006_catalog.sql',
      '0007_shelf_entry_pages.sql',
      '0008_community.sql',
    ]);
  });

  it('keeps catalog books unique and validates catalog metadata', async () => {
    await applyMigrations(client(), loadMigrations());
    await pg.query(
      `INSERT INTO "books" ("id", "title", "catalog_key", "cover_url", "isbn") VALUES ('b1', 'Duna', 'isbn:9788576573135', 'https://covers.openlibrary.org/b/id/1-L.jpg', '9788576573135')`,
    );
    await expect(
      pg.query(
        `INSERT INTO "books" ("id", "title", "catalog_key") VALUES ('b2', 'Duna', 'isbn:9788576573135')`,
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        `INSERT INTO "books" ("id", "title", "cover_url") VALUES ('b3', 'X', 'http://insecure.example/c.jpg')`,
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(`INSERT INTO "books" ("id", "title", "published_year") VALUES ('b4', 'X', 3000)`),
    ).rejects.toThrow();
    // Manual books have no catalog key and may repeat freely.
    await pg.query(`INSERT INTO "books" ("id", "title") VALUES ('b5', 'Duna')`);
    await pg.query(`INSERT INTO "books" ("id", "title") VALUES ('b6', 'Duna')`);
  });

  it('rolls back a failing migration', async () => {
    const broken = [
      { name: '0001_broken.sql', sql: 'CREATE TABLE "t" ("id" int); SELECT nope();' },
    ];
    await expect(applyMigrations(client(), broken)).rejects.toThrow();
    const { rows } = await pg.query(`SELECT to_regclass('"t"') AS t`);
    expect(rows[0]).toEqual({ t: null });
  });

  it('rejects badly named migrations', async () => {
    await expect(applyMigrations(client(), [{ name: 'init.sql', sql: '' }])).rejects.toThrow(
      /Invalid migration name/,
    );
  });

  it('enforces onboarding constraints in SQL', async () => {
    await applyMigrations(client(), loadMigrations());
    await insertUser();
    await expect(
      pg.query(
        `INSERT INTO "reader_profiles" ("user_id", "reading_habit") VALUES ('u1', 'sometimes')`,
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(`INSERT INTO "books" ("id", "title", "total_pages") VALUES ('b1', 'X', 0)`),
    ).rejects.toThrow();

    await pg.query(`INSERT INTO "books" ("id", "title") VALUES ('b1', 'Duna')`);
    await pg.query(
      `INSERT INTO "shelf_entries" ("id", "user_id", "book_id", "status") VALUES ('s1', 'u1', 'b1', 'reading')`,
    );
    await expect(
      pg.query(
        `INSERT INTO "shelf_entries" ("id", "user_id", "book_id") VALUES ('s2', 'u1', 'b1')`,
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        `INSERT INTO "shelf_entries" ("id", "user_id", "book_id", "status") VALUES ('s3', 'u1', 'b1', 'lost')`,
      ),
    ).rejects.toThrow();
  });

  it('cascades reader data when a user is deleted', async () => {
    await applyMigrations(client(), loadMigrations());
    await insertUser();
    await pg.query(
      `INSERT INTO "reader_profiles" ("user_id", "goals") VALUES ('u1', ARRAY['remember_more'])`,
    );
    await pg.query(
      `INSERT INTO "books" ("id", "title", "created_by_user_id") VALUES ('b1', 'Duna', 'u1')`,
    );
    await pg.query(
      `INSERT INTO "shelf_entries" ("id", "user_id", "book_id") VALUES ('s1', 'u1', 'b1')`,
    );
    await pg.query(`DELETE FROM "users" WHERE "id" = 'u1'`);
    const counts = await pg.query<{ p: number; s: number; b: string | null }>(
      `SELECT (SELECT count(*)::int FROM "reader_profiles") AS p, (SELECT count(*)::int FROM "shelf_entries") AS s, (SELECT "created_by_user_id" FROM "books" WHERE "id" = 'b1') AS b`,
    );
    expect(counts.rows[0]).toEqual({ p: 0, s: 0, b: null });
  });
});

describe('reading sessions constraints', () => {
  it('rejects implausible sessions and cascades with the shelf entry', async () => {
    await applyMigrations(client(), loadMigrations());
    await insertUser();
    await pg.query(`INSERT INTO "books" ("id", "title") VALUES ('b1', 'Duna')`);
    await pg.query(
      `INSERT INTO "shelf_entries" ("id", "user_id", "book_id") VALUES ('s1', 'u1', 'b1')`,
    );
    const insert = (id: string, seconds: number, start: number, end: number) =>
      pg.query(
        `INSERT INTO "reading_sessions" ("id", "user_id", "shelf_entry_id", "started_at", "ended_at", "focused_seconds", "start_page", "end_page", "local_date")
         VALUES ($1, 'u1', 's1', now() - interval '1 hour', now(), $2, $3, $4, '2026-09-26')`,
        [id, seconds, start, end],
      );
    await insert('r1', 1500, 10, 30);
    await expect(insert('r2', 30, 0, 1)).rejects.toThrow();
    await expect(insert('r3', 20000, 0, 1)).rejects.toThrow();
    await expect(insert('r4', 600, 30, 10)).rejects.toThrow();
    await pg.query(`DELETE FROM "shelf_entries" WHERE "id" = 's1'`);
    const { rows } = await pg.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "reading_sessions"`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('enforces community constraints and cascades with the account', async () => {
    await applyMigrations(client(), loadMigrations());
    await insertUser('u1');
    await insertUser('u2');
    await pg.query(
      `INSERT INTO "books" ("id", "title", "catalog_key") VALUES ('b1', 'Duna', 'ol:1')`,
    );
    const club = (id: string, icon: string) =>
      pg.query(
        `INSERT INTO "reading_clubs" ("id", "owner_user_id", "name", "icon", "book_id") VALUES ($1, 'u1', 'Clube', $2, 'b1')`,
        [id, icon],
      );
    await club('c1', 'planet');
    await expect(club('c2', 'emoji')).rejects.toThrow();
    const post = (id: string, page: number) =>
      pg.query(
        `INSERT INTO "reading_club_posts" ("id", "club_id", "author_user_id", "title", "body", "spoiler_page") VALUES ($1, 'c1', 'u2', 'Tópico', 'Texto', $2)`,
        [id, page],
      );
    await post('p1', 120);
    await expect(post('p2', -1)).rejects.toThrow();
    await expect(post('p3', 20001)).rejects.toThrow();
    const report = (id: string) =>
      pg.query(
        `INSERT INTO "reading_club_reports" ("id", "reporter_user_id", "club_id", "target_type", "target_id", "reason") VALUES ($1, 'u1', 'c1', 'post', 'p1', 'spoiler')`,
        [id],
      );
    await report('r1');
    await expect(report('r2')).rejects.toThrow();
    await expect(
      pg.query(
        `INSERT INTO "user_blocks" ("blocker_user_id", "blocked_user_id") VALUES ('u1', 'u1')`,
      ),
    ).rejects.toThrow();
    // A club's book cannot disappear under it.
    await expect(pg.query(`DELETE FROM "books" WHERE "id" = 'b1'`)).rejects.toThrow();
    // Deleting the owner removes the club and everything in it.
    await pg.query(`DELETE FROM "users" WHERE "id" = 'u1'`);
    const { rows } = await pg.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM "reading_clubs") + (SELECT count(*) FROM "reading_club_posts") + (SELECT count(*) FROM "reading_club_reports")::int AS n`,
    );
    expect(Number(rows[0]?.n)).toBe(0);
  });
});
