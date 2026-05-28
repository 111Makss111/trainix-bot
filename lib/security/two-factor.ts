import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { getSql } from "@/lib/neon";
import { isOwnerAuthDatabaseFallbackEnabled } from "@/lib/owner-auth-fallback";
import {
  buildTotpUri,
  generateBackupCodes,
  generateTotpSecret,
  normalizeBackupCode,
  verifyTotpCode,
} from "./totp";

const TWO_FACTOR_COOKIE_NAME = "trainix-2fa";
const TWO_FACTOR_COOKIE_VERSION = "v1";
const TWO_FACTOR_ISSUER = "Trainix Cabinet";

let hasEnsuredTwoFactorColumns = false;

type TwoFactorProfileRow = {
  two_factor_enabled: boolean;
  two_factor_secret_encrypted: string | null;
  two_factor_setup_secret_encrypted: string | null;
  two_factor_backup_codes_json: string | null;
  two_factor_enabled_at: string | null;
};

export type TwoFactorSettingsState = {
  enabled: boolean;
  pendingSetup: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
  manualEntryKey: string | null;
  otpauthUri: string | null;
  accountLabel: string;
  issuer: string;
};

function getAppSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for two-factor security");
  }

  return secret;
}

function getEncryptionKey() {
  return scryptSync(getAppSecret(), "trainix-two-factor", 32);
}

function encryptValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptValue(payload: string | null) {
  if (!payload) {
    return null;
  }

  const [ivPart, tagPart, encryptedPart] = payload.split(".");

  if (!ivPart || !tagPart || !encryptedPart) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

function hashBackupCode(code: string) {
  return createHash("sha256")
    .update(`${getAppSecret()}:${normalizeBackupCode(code)}`)
    .digest("hex");
}

function parseBackupCodeHashes(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

async function ensureTwoFactorColumns() {
  if (hasEnsuredTwoFactorColumns) {
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

  hasEnsuredTwoFactorColumns = true;
}

async function getTwoFactorRow(ownerEmail: string) {
  try {
    await ensureTwoFactorColumns();

    const sql = getSql();

    if (!sql) {
      return null;
    }

    const [row] = (await sql`
      SELECT
        two_factor_enabled,
        two_factor_secret_encrypted,
        two_factor_setup_secret_encrypted,
        two_factor_backup_codes_json,
        two_factor_enabled_at
      FROM profiles
      WHERE email = ${ownerEmail}
      LIMIT 1
    `) as TwoFactorProfileRow[];

    return row ?? null;
  } catch (error) {
    console.error("Failed to read two-factor state", error);

    if (isOwnerAuthDatabaseFallbackEnabled()) {
      return null;
    }

    throw error;
  }
}

export async function getTwoFactorSettingsState(
  ownerEmail: string,
): Promise<TwoFactorSettingsState> {
  const row = await getTwoFactorRow(ownerEmail);
  const pendingSecret = decryptValue(row?.two_factor_setup_secret_encrypted ?? null);
  const backupCodeHashes = parseBackupCodeHashes(
    row?.two_factor_backup_codes_json ?? null,
  );

  return {
    enabled: Boolean(row?.two_factor_enabled),
    pendingSetup: Boolean(pendingSecret),
    enabledAt: row?.two_factor_enabled_at ?? null,
    backupCodesRemaining: backupCodeHashes.length,
    manualEntryKey: pendingSecret,
    otpauthUri: pendingSecret
      ? buildTotpUri({
          issuer: TWO_FACTOR_ISSUER,
          accountName: ownerEmail,
          secret: pendingSecret,
        })
      : null,
    accountLabel: ownerEmail,
    issuer: TWO_FACTOR_ISSUER,
  };
}

export async function beginTwoFactorSetup(ownerEmail: string) {
  await ensureTwoFactorColumns();

  const sql = getSql();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  const secret = generateTotpSecret();

  await sql`
    UPDATE profiles
    SET
      two_factor_setup_secret_encrypted = ${encryptValue(secret)},
      updated_at = NOW()
    WHERE email = ${ownerEmail}
  `;

  return getTwoFactorSettingsState(ownerEmail);
}

export async function cancelTwoFactorSetup(ownerEmail: string) {
  await ensureTwoFactorColumns();

  const sql = getSql();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  await sql`
    UPDATE profiles
    SET
      two_factor_setup_secret_encrypted = NULL,
      updated_at = NOW()
    WHERE email = ${ownerEmail}
  `;

  return getTwoFactorSettingsState(ownerEmail);
}

export async function enableTwoFactorForOwner(ownerEmail: string, code: string) {
  const row = await getTwoFactorRow(ownerEmail);
  const pendingSecret = decryptValue(row?.two_factor_setup_secret_encrypted ?? null);

  if (!pendingSecret) {
    throw new Error("Two-factor setup is not ready yet");
  }

  if (!verifyTotpCode({ secret: pendingSecret, code })) {
    throw new Error("Невірний код. Спробуй ще раз.");
  }

  const backupCodes = generateBackupCodes();
  const backupCodeHashes = backupCodes.map(hashBackupCode);
  const sql = getSql();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  await sql`
    UPDATE profiles
    SET
      two_factor_enabled = TRUE,
      two_factor_secret_encrypted = ${encryptValue(pendingSecret)},
      two_factor_setup_secret_encrypted = NULL,
      two_factor_backup_codes_json = ${JSON.stringify(backupCodeHashes)},
      two_factor_enabled_at = NOW(),
      two_factor_last_verified_at = NOW(),
      updated_at = NOW()
    WHERE email = ${ownerEmail}
  `;

  await setTwoFactorVerificationCookie(ownerEmail);

  return {
    state: await getTwoFactorSettingsState(ownerEmail),
    backupCodes,
  };
}

export async function disableTwoFactorForOwner(
  ownerEmail: string,
  verificationCode: string,
) {
  const row = await getTwoFactorRow(ownerEmail);
  const activeSecret = decryptValue(row?.two_factor_secret_encrypted ?? null);

  if (!row?.two_factor_enabled || !activeSecret) {
    throw new Error("Two-factor is not enabled");
  }

  const verification = await verifyTwoFactorCode(ownerEmail, verificationCode);

  if (!verification.ok) {
    throw new Error("Підтвердження не пройшло. Введи поточний код або backup code.");
  }

  const sql = getSql();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  await sql`
    UPDATE profiles
    SET
      two_factor_enabled = FALSE,
      two_factor_secret_encrypted = NULL,
      two_factor_setup_secret_encrypted = NULL,
      two_factor_backup_codes_json = NULL,
      two_factor_enabled_at = NULL,
      two_factor_last_verified_at = NULL,
      updated_at = NOW()
    WHERE email = ${ownerEmail}
  `;

  await clearTwoFactorVerificationCookie();

  return getTwoFactorSettingsState(ownerEmail);
}

export async function isTwoFactorEnabledForOwner(ownerEmail: string) {
  const row = await getTwoFactorRow(ownerEmail);

  return Boolean(row?.two_factor_enabled && row.two_factor_secret_encrypted);
}

export async function verifyTwoFactorCode(ownerEmail: string, code: string) {
  const row = await getTwoFactorRow(ownerEmail);
  const activeSecret = decryptValue(row?.two_factor_secret_encrypted ?? null);

  if (!row?.two_factor_enabled || !activeSecret) {
    return { ok: false as const, usedBackupCode: false };
  }

  const sql = getSql();

  if (!sql) {
    return { ok: false as const, usedBackupCode: false };
  }

  if (verifyTotpCode({ secret: activeSecret, code })) {
    await sql`
      UPDATE profiles
      SET
        two_factor_last_verified_at = NOW(),
        updated_at = NOW()
      WHERE email = ${ownerEmail}
    `;

    return { ok: true as const, usedBackupCode: false };
  }

  const normalizedBackupCode = normalizeBackupCode(code);
  const backupCodeHash = hashBackupCode(normalizedBackupCode);
  const backupCodeHashes = parseBackupCodeHashes(
    row.two_factor_backup_codes_json ?? null,
  );
  const matchingHash = backupCodeHashes.find((storedHash) => {
    const stored = Buffer.from(storedHash);
    const current = Buffer.from(backupCodeHash);

    return (
      stored.length === current.length &&
      timingSafeEqual(stored, current)
    );
  });

  if (!matchingHash) {
    return { ok: false as const, usedBackupCode: false };
  }

  const remainingBackupCodes = backupCodeHashes.filter(
    (storedHash) => storedHash !== matchingHash,
  );

  await sql`
    UPDATE profiles
    SET
      two_factor_backup_codes_json = ${JSON.stringify(remainingBackupCodes)},
      two_factor_last_verified_at = NOW(),
      updated_at = NOW()
    WHERE email = ${ownerEmail}
  `;

  return { ok: true as const, usedBackupCode: true };
}

function signTwoFactorPayload(payload: string) {
  return createHmac("sha256", getAppSecret())
    .update(payload)
    .digest("base64url");
}

function encodeCookiePayload(ownerEmail: string) {
  const payload = JSON.stringify({
    v: TWO_FACTOR_COOKIE_VERSION,
    email: ownerEmail,
    verifiedAt: Date.now(),
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");

  return `${encoded}.${signTwoFactorPayload(encoded)}`;
}

function decodeCookiePayload(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signTwoFactorPayload(encoded);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));

    if (
      parsed?.v !== TWO_FACTOR_COOKIE_VERSION ||
      typeof parsed?.email !== "string"
    ) {
      return null;
    }

    return parsed as {
      v: string;
      email: string;
      verifiedAt: number;
    };
  } catch {
    return null;
  }
}

export async function setTwoFactorVerificationCookie(ownerEmail: string) {
  const cookieStore = await cookies();

  cookieStore.set(TWO_FACTOR_COOKIE_NAME, encodeCookiePayload(ownerEmail), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearTwoFactorVerificationCookie() {
  const cookieStore = await cookies();

  cookieStore.set(TWO_FACTOR_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function hasVerifiedTwoFactorForOwner(ownerEmail: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TWO_FACTOR_COOKIE_NAME)?.value;
  const payload = decodeCookiePayload(token);

  return payload?.email === ownerEmail;
}
