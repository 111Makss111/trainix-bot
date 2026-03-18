import { randomUUID } from "crypto";
import { getSql } from "./neon";

type EnsureOwnerProfileInput = {
  email: string;
  googleSub: string;
  name?: string | null;
  image?: string | null;
};

export async function ensureOwnerProfile(input: EnsureOwnerProfileInput) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const email = input.email.trim().toLowerCase();

  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      google_sub TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      display_name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO profiles (
      id,
      email,
      google_sub,
      role,
      display_name,
      avatar_url
    )
    VALUES (
      ${randomUUID()},
      ${email},
      ${input.googleSub},
      ${"owner"},
      ${input.name ?? null},
      ${input.image ?? null}
    )
    ON CONFLICT (email) DO UPDATE
    SET
      google_sub = EXCLUDED.google_sub,
      role = ${"owner"},
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
  `;
}
