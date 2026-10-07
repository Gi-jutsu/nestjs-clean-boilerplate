import { scrypt, timingSafeEqual } from "node:crypto";

const LEGACY_HASH_LENGTH = 161;
const LEGACY_HASH_FORMAT = /^[a-f0-9]{32}:[a-f0-9]{128}$/;
const MAX_PASSWORD_BYTES = 4096;

export function isLegacyPasswordHash(hash: string): boolean {
  return hash.length === LEGACY_HASH_LENGTH && LEGACY_HASH_FORMAT.test(hash);
}

export async function verifyLegacyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!isLegacyPasswordHash(hash) || password.length > MAX_PASSWORD_BYTES) {
    return false;
  }

  const input = Buffer.from(password.normalize("NFKC"), "utf8");
  if (input.length === 0 || input.length > MAX_PASSWORD_BYTES) {
    return false;
  }

  const [salt, encodedKey] = hash.split(":");
  // Better Auth uses the hexadecimal salt as UTF-8 text, not decoded bytes.
  const actualKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      input,
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });

  return timingSafeEqual(actualKey, Buffer.from(encodedKey, "hex"));
}
