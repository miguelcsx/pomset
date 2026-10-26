/**
 * Content-addressed bytes.
 *
 * A local workbench keeps them in a filesystem store beside its SQLite database;
 * a hosted deployment keeps them in an object store. Guessing a hash grants
 * nothing: retrieval is authorized per request against ownership, which is why
 * this port exposes bytes and nothing about how they are addressed.
 *
 * Asynchronous for the same reason the record store is: an object store is
 * reached over a network.
 */

export interface BlobStore {
  /** Reads back the bytes captured for a content hash. */
  bytes(hash: string): Promise<Buffer>;

  /** Captures bytes, content-addressed. Returns the hash. */
  putBytes(bytes: Uint8Array): Promise<string>;
}
