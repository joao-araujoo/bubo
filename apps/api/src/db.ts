import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as authSchema from './db/auth-schema';

export function database(databaseUrl: string) {
  return neon(databaseUrl);
}

export function authDatabase(databaseUrl: string) {
  const client = neon(databaseUrl);
  return drizzle(client, { schema: authSchema });
}
