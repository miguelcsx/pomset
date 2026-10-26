/**
 * Snapshot manifests.
 *
 * A snapshot is immutable from creation. Editing creates a **child** snapshot
 * that names its parent; no job or result is ever retargeted, and a result keeps
 * the snapshot it was analysed from even after the source changes.
 *
 * The manifest hash is computed over the RFC 8785 canonical serialization of the
 * manifest with its own `manifestHash` member omitted. Because the canonical
 * form sorts member names, reordering the same file set does not change the
 * hash, and because the hash is derived from the manifest rather than supplied
 * beside it, the two cannot disagree.
 */

import type { SnapshotFile, SnapshotManifest } from "@pomset/contracts";

import { canonicalize } from "./canonicalize.js";
import { sha256Of } from "./identity.js";
import { accepted, inputInvalid, pointer, rejected, type Rejection, type Validated } from "./rejection.js";

// The contract's pattern, including its negative lookaheads: a normalized POSIX
// relative path, never absolute, never containing `..` and never a backslash.
// The character class alone would admit `.` and `..` as segments.
const POSIX_RELATIVE = /^(?!\/)(?!.*\.\.)(?!.*\\)[A-Za-z0-9._@+-]+(\/[A-Za-z0-9._@+-]+)*$/;

/**
 * The manifest hash: SHA-256 over the canonical serialization with the hash
 * member omitted. The member is deleted, never set to null, because a null would
 * be part of the serialization and change the hash.
 */
export function manifestHash(manifest: SnapshotManifest): string {
  const withoutHash: Record<string, unknown> = { ...manifest };
  delete withoutHash["manifestHash"];
  return sha256Of(canonicalize(withoutHash));
}

/**
 * Validates the file set a manifest may describe: normalized POSIX relative
 * paths, no absolute path, no traversal, no backslash, no duplicate path and no
 * symlink entry.
 */
export function validateManifestFiles(
  files: readonly SnapshotFile[],
): Validated<readonly SnapshotFile[]> {
  const rejections: Rejection[] = [];
  const seen = new Set<string>();
  if (files.length === 0) {
    rejections.push(inputInvalid(pointer("files"), "a manifest describes an explicit file set"));
  }
  files.forEach((file, index) => {
    const at = pointer("files", String(index), "path");
    if (!POSIX_RELATIVE.test(file.path)) {
      rejections.push(
        inputInvalid(
          at,
          "a manifest path is a normalized POSIX relative path with no traversal and no symlink",
          { path: file.path },
        ),
      );
    }
    if (seen.has(file.path)) {
      rejections.push(inputInvalid(at, `duplicate path ${file.path}`));
    }
    seen.add(file.path);
    if (file.bytes < 0) {
      rejections.push(
        inputInvalid(pointer("files", String(index), "bytes"), "byte count is negative"),
      );
    }
  });
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(files);
}

/** A manifest and its hash, computed together. */
export function buildManifest(
  manifest: Omit<SnapshotManifest, "manifestHash" | "schemaVersion">,
): Validated<SnapshotManifest> {
  const files = validateManifestFiles(manifest.files);
  if (!files.ok) return files;
  const complete: SnapshotManifest = {
    schemaVersion: 1,
    ...manifest,
    files: files.value,
    manifestHash: `sha256:${"0".repeat(64)}`,
  };
  return accepted({ ...complete, manifestHash: manifestHash(complete) });
}

/**
 * The snapshot an edit produces: a new, immutable manifest naming the one it
 * derives from. The parent is returned unchanged, byte for byte, and nothing
 * that referenced it is retargeted.
 */
export function childSnapshot(
  parent: SnapshotManifest,
  edit: {
    readonly snapshotId: string;
    readonly createdAt: string;
    readonly files: readonly SnapshotFile[];
  },
): Validated<{ readonly child: SnapshotManifest; readonly parent: SnapshotManifest }> {
  const built = buildManifest({
    snapshotId: edit.snapshotId,
    projectId: parent.projectId,
    createdAt: edit.createdAt,
    parentSnapshotId: parent.snapshotId,
    files: edit.files,
  });
  if (!built.ok) return built;
  return accepted({ child: built.value, parent });
}
