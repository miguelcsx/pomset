/**
 * Content-addressed bytes.
 *
 * A local workbench keeps them in a filesystem store beside its SQLite database;
 * a hosted deployment keeps them in an object store. Guessing a hash grants
 * nothing: retrieval is authorized per request against ownership, which is why
 * this port exposes bytes and nothing about how they are addressed.
 */

export interface BlobStore {
  /** Reads back the bytes captured for a content hash. */
  bytes(hash: string): Buffer;

  /** Captures bytes, content-addressed. Returns the hash. */
  putBytes(bytes: Uint8Array): string;
}
