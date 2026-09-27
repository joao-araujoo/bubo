import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDatabaseUrl, migrationDatabaseUrl } from '../src/node';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) {
    fs.unlinkSync(path.join(folder, '.dev.vars'));
    fs.rmdirSync(folder);
  }
});
describe('database environment loading', () => {
  it('uses process configuration first, then only the designated dev.vars file', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bubo-env-test-'));
    folders.push(directory);
    const file = path.join(directory, '.dev.vars');
    fs.writeFileSync(file, 'DATABASE_URL="postgres://fixture@localhost/local"\n');
    expect(loadDatabaseUrl({}, file)).toBe('postgres://fixture@localhost/local');
    expect(loadDatabaseUrl({ DATABASE_URL: 'postgres://fixture@localhost/process' }, file)).toBe(
      'postgres://fixture@localhost/process',
    );
    fs.writeFileSync(file, 'DATABASE_URL=""\n');
    expect(loadDatabaseUrl({}, file)).toBeUndefined();
    expect(loadDatabaseUrl({}, path.join(directory, 'missing'))).toBeUndefined();
  });
  it('derives a direct Neon migration connection without changing database or credentials', () => {
    const original = new URL(
      'postgres://fixture:placeholder@host-pooler.neon.tech/bubo?sslmode=require',
    );
    const direct = new URL(migrationDatabaseUrl(original.href));
    expect(direct.hostname).toBe('host.neon.tech');
    expect(direct.pathname).toBe(original.pathname);
    expect(direct.password).toBe(original.password);
    expect(direct.username).toBe(original.username);
    expect(direct.search).toBe(original.search);
    expect(original.hostname).toContain('-pooler.');
  });
});
