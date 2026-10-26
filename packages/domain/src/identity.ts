/**
 * Content identity.
 *
 * Content identity is SHA-256 over the **original bytes**, with no
 * canonicalization: a manifest's hash is computed over the canonical
 * serialization of the manifest itself, in `manifest.ts`, and that is a
 * different rule for a different thing.
 *
 * Ownership is separate. Two owners may hold byte-identical artifacts, internal
 * deduplication stores the bytes once, and a content hash is never an access
 * credential — it grants nothing to whoever possesses it.
 */

import { createHash } from "node:crypto";

/** The prefixed lowercase-hex form the contract uses for a content hash. */
export function sha256Of(bytes: Uint8Array | string): string {
  const hash = createHash("sha256");
  hash.update(typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes);
  return `sha256:${hash.digest("hex")}`;
}

/** One file's identity: SHA-256 over its original bytes. */
export function fileHash(originalBytes: Uint8Array | string): string {
  return sha256Of(originalBytes);
}

/** A content-addressed key for an artifact's bytes. */
export function contentAddress(bytes: Uint8Array | string): string {
  return sha256Of(bytes);
}

/** True for a well-formed content hash, so a malformed one is refused early. */
export function isContentHash(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(value);
}
