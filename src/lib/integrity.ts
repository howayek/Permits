/**
 * Document integrity utilities — compute SHA-256 client-side and verify
 * downloaded files against their stored hash.
 */

export async function computeSHA256(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface IntegrityCheckResult {
  ok: boolean;
  expected: string | null;
  actual: string;
}

/**
 * Compares a downloaded blob's SHA-256 against the expected hash from the database.
 * Returns ok=true if they match (case-insensitive). Returns ok=null when
 * no expected hash is stored (cannot verify).
 */
export async function verifyIntegrity(
  blob: Blob,
  expectedSha256: string | null | undefined
): Promise<IntegrityCheckResult> {
  const actual = await computeSHA256(blob);
  if (!expectedSha256) {
    return { ok: false, expected: null, actual };
  }
  return {
    ok: actual.toLowerCase() === expectedSha256.toLowerCase(),
    expected: expectedSha256,
    actual,
  };
}
