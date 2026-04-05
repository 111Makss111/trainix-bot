import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type VerifyTotpOptions = {
  secret: string;
  code: string;
  digits?: number;
  period?: number;
  window?: number;
  timestamp?: number;
};

function normalizeBase32(input: string) {
  return input.replace(/=+$/g, "").replace(/[\s-]+/g, "").toUpperCase();
}

function normalizeDigits(input: string) {
  return input.replace(/\D/g, "");
}

export function encodeBase32(buffer: Buffer) {
  let output = "";
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(input: string) {
  const normalized = normalizeBase32(input);
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      continue;
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

export function generateTotpSecret(bytes = 20) {
  return encodeBase32(randomBytes(bytes));
}

export function buildTotpUri(input: {
  issuer: string;
  accountName: string;
  secret: string;
  digits?: number;
  period?: number;
}) {
  const digits = input.digits ?? 6;
  const period = input.period ?? 30;
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const issuer = encodeURIComponent(input.issuer);

  return `otpauth://totp/${label}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=${digits}&period=${period}`;
}

function generateHotp(secret: string, counter: number, digits = 6) {
  const secretBuffer = decodeBase32(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function generateTotpCode(input: {
  secret: string;
  timestamp?: number;
  digits?: number;
  period?: number;
}) {
  const digits = input.digits ?? 6;
  const period = input.period ?? 30;
  const timestamp = input.timestamp ?? Date.now();
  const counter = Math.floor(timestamp / 1000 / period);

  return generateHotp(input.secret, counter, digits);
}

export function verifyTotpCode({
  secret,
  code,
  digits = 6,
  period = 30,
  window = 1,
  timestamp = Date.now(),
}: VerifyTotpOptions) {
  const normalizedCode = normalizeDigits(code);

  if (normalizedCode.length !== digits) {
    return false;
  }

  const baseCounter = Math.floor(timestamp / 1000 / period);
  const provided = Buffer.from(normalizedCode);

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = Buffer.from(generateHotp(secret, baseCounter + offset, digits));

    if (
      expected.length === provided.length &&
      timingSafeEqual(expected, provided)
    ) {
      return true;
    }
  }

  return false;
}

function generateBackupCodeChunk(length: number) {
  const bytes = randomBytes(length);
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += BACKUP_CODE_ALPHABET[bytes[index] % BACKUP_CODE_ALPHABET.length];
  }

  return output;
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const left = generateBackupCodeChunk(4);
    const right = generateBackupCodeChunk(4);

    return `${left}-${right}`;
  });
}

export function normalizeBackupCode(input: string) {
  return input.replace(/[\s-]+/g, "").toUpperCase();
}
