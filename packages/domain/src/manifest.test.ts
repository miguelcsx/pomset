import { describe, expect, it } from "vitest";

import type { SnapshotFile, SnapshotManifest } from "@pomset/contracts";

import { contentAddress, fileHash, isContentHash } from "./identity.js";
import { buildManifest, childSnapshot, manifestHash, validateManifestFiles } from "./manifest.js";

const source: SnapshotFile = {
  path: "kernels/transform.py",
  role: "source",
  sha256: "sha256:4d3f0a0f2b6d1c8e9a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f",
  bytes: 412,
};

function manifest(files: readonly SnapshotFile[]): SnapshotManifest {
  const built = buildManifest({
    snapshotId: "snp_01HN3",
    projectId: "prj_7Qd2",
    createdAt: "2026-01-05T12:00:00Z",
    files,
  });
  if (!built.ok) throw new Error("fixture manifest must be valid");
  return built.value;
}

describe("content identity", () => {
  it("hashes a file's original bytes with SHA-256", () => {
    expect(fileHash("hello")).toBe(
      "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("produces the same hash for the same bytes every time", () => {
    expect(contentAddress("same")).toBe(contentAddress("same"));
  });

  it("recognises a well-formed content hash", () => {
    expect(isContentHash(fileHash("x"))).toBe(true);
    expect(isContentHash("sha256:NOTHEX")).toBe(false);
    expect(isContentHash("md5:abc")).toBe(false);
  });
});

describe("snapshot manifests", () => {
  it("derives the hash from the manifest rather than beside it", () => {
    const built = manifest([source]);
    expect(built.manifestHash).toBe(manifestHash(built));
  });

  it("omits the hash member rather than nulling it", () => {
    const built = manifest([source]);
    const withNull = { ...built, manifestHash: null } as unknown as SnapshotManifest;
    // Replacing the placeholder with null still hashes the same, because the
    // member is deleted before serialization.
    expect(manifestHash(withNull)).toBe(built.manifestHash);
  });

  it("is stable across member order", () => {
    const built = manifest([source]);
    const shuffled = Object.fromEntries(Object.entries(built).reverse()) as SnapshotManifest;
    expect(manifestHash(shuffled)).toBe(built.manifestHash);
  });

  it("rejects an absolute path", () => {
    const result = validateManifestFiles([{ ...source, path: "/etc/passwd" }]);
    expect(result.ok).toBe(false);
  });

  it("rejects an escaping path", () => {
    const result = validateManifestFiles([{ ...source, path: "../outside/scenario.json" }]);
    expect(result.ok).toBe(false);
  });

  it("rejects a backslash path, which is not a POSIX relative path", () => {
    const result = validateManifestFiles([{ ...source, path: "kernels\\transform.py" }]);
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicate path", () => {
    const result = validateManifestFiles([source, source]);
    expect(result.ok).toBe(false);
  });
});

describe("editing a snapshot", () => {
  it("creates a child that names its parent and leaves the parent untouched", () => {
    const parent = manifest([source]);
    const before = JSON.stringify(parent);
    const edited: SnapshotFile = {
      ...source,
      sha256: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      bytes: 420,
    };
    const result = childSnapshot(parent, {
      snapshotId: "snp_01HN5",
      createdAt: "2026-01-05T12:09:00Z",
      files: [edited],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.child.parentSnapshotId).toBe(parent.snapshotId);
    expect(result.value.child.manifestHash).not.toBe(parent.manifestHash);
    // The parent is returned byte-identical: no result is ever retargeted.
    expect(JSON.stringify(result.value.parent)).toBe(before);
  });
});
