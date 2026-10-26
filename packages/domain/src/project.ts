/**
 * Projects and the records that belong to them.
 *
 * A project is a named, owned container of multiple files, versioned by
 * immutable snapshots. Ownership is a server-side mapping from an identity
 * provider's `(issuer, subject)` to an opaque `ownerId`: a value supplied by a
 * caller is data and never authorization, so nothing here derives ownership
 * from an input.
 */

import type { Project as ProjectRecord, SnapshotFile, SnapshotManifest } from "@pomset/contracts";

import { accepted, inputInvalid, pointer, rejected, type Validated, type Rejection } from "./rejection.js";

export type Project = ProjectRecord;
export type Snapshot = SnapshotManifest;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** The roles a snapshot file may take. */
export const SNAPSHOT_FILE_ROLES = [
  "source",
  "config",
  "reference",
  "fixture",
  "other",
] as const;

export function createProject(record: ProjectRecord): Validated<Project> {
  const rejections: Rejection[] = [];
  if (!IDENTIFIER.test(record.projectId)) {
    rejections.push(inputInvalid(pointer("projectId"), "project id is not a valid opaque handle"));
  }
  if (!record.ownerId) {
    rejections.push(
      inputInvalid(pointer("ownerId"), "a project must record the server-owned owner it belongs to"),
    );
  }
  if (record.title.trim().length === 0) {
    rejections.push(inputInvalid(pointer("title"), "a project must have a title"));
  }
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(record);
}

/** True when the record belongs to this owner. Ownership is never transferred. */
export function isOwnedBy(record: { readonly ownerId?: string }, ownerId: string): boolean {
  return record.ownerId === ownerId;
}

/**
 * A snapshot file set is validated on the way in: normalized POSIX relative
 * paths, no absolute paths, no traversal, no duplicates. The bytes are hashed
 * separately, by `manifest.ts`.
 */
export function validateSnapshotFiles(files: readonly SnapshotFile[]): Validated<readonly SnapshotFile[]> {
  const rejections = [];
  const seen = new Set<string>();
  if (files.length === 0) {
    rejections.push(inputInvalid(pointer(), "a snapshot is created from an explicit file set"));
  }
  files.forEach((file, index) => {
    const at = pointer(String(index), "path");
    if (file.path.startsWith("/")) {
      rejections.push(inputInvalid(at, "snapshot paths are relative, never absolute"));
    } else if (file.path.split("/").includes("..")) {
      rejections.push(inputInvalid(at, "snapshot paths never escape their root"));
    } else if (file.path.includes("\\")) {
      rejections.push(inputInvalid(at, "snapshot paths are POSIX relative paths"));
    }
    if (seen.has(file.path)) {
      rejections.push(inputInvalid(at, `duplicate path ${file.path}`));
    }
    seen.add(file.path);
  });
  if (rejections.length > 0) return rejected(...rejections);
  return accepted(files);
}
