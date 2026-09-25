import { neon } from '@neondatabase/serverless';

export function database(databaseUrl: string) {
  return neon(databaseUrl);
}
