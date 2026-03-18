import { neon } from "@neondatabase/serverless";

export function getSql() {
  const databaseUrl = process.env.NEON_DATABASE_URL?.trim();

  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl);
}
