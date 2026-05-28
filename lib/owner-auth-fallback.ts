const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isOwnerAuthDatabaseFallbackEnabled() {
  const value = process.env.OWNER_AUTH_DB_FALLBACK?.trim().toLowerCase();

  return Boolean(value && ENABLED_VALUES.has(value));
}
