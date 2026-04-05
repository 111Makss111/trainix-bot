import { randomUUID } from "crypto";
import { getSql } from "./neon";

type EnsureOwnerProfileInput = {
  email: string;
  googleSub: string;
  name?: string | null;
  image?: string | null;
};

let hasEnsuredProfilesTable = false;

async function ensureProfilesTable() {
  if (hasEnsuredProfilesTable) {
    return;
  }

  const sql = getSql();

  if (!sql) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      google_sub TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      display_name TEXT,
      avatar_url TEXT,
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      two_factor_secret_encrypted TEXT,
      two_factor_setup_secret_encrypted TEXT,
      two_factor_backup_codes_json TEXT,
      two_factor_enabled_at TIMESTAMPTZ,
      two_factor_last_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS two_factor_secret_encrypted TEXT
  `;
  await sql`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS two_factor_setup_secret_encrypted TEXT
  `;
  await sql`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS two_factor_backup_codes_json TEXT
  `;
  await sql`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS two_factor_last_verified_at TIMESTAMPTZ
  `;

  hasEnsuredProfilesTable = true;
}

export async function ensureOwnerProfile(input: EnsureOwnerProfileInput) {
  const sql = getSql();

  if (!sql) {
    return;
  }

  const email = input.email.trim().toLowerCase();

  await ensureProfilesTable();

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
