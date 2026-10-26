import { describe, expect, it } from "vitest";

import type { Capability, ProfileRevision } from "@pomset/contracts";

import { createCapability, createProfileRevision, effectiveAvailability, explainMissingCapability, revisionHashOf } from "./profile.js";

function capability(overrides: Partial<Capability> = {}): Capability {
  return {
    schemaVersion: 1,
    capabilityId: "cap_1",
    profileRevisionId: "prf_1",
    backend: "triton",
    feature: "outputCoverage",
    support: "untested",
    availability: "immediate",
    reason: "no conformance corpus has run against this revision",
    ...overrides,
  } as Capability;
}

const revision: ProfileRevision = {
  schemaVersion: 1,
  profileRevisionId: "prf_1",
  backend: "triton",
  revisionHash: `sha256:${"a".repeat(64)}`,
  createdAt: "2026-01-05T12:00:00Z",
  components: [{ name: "z3", version: "4.13.0" }],
  platform: { os: "linux", arch: "x86_64" },
  capabilityIds: ["cap_1"],
};

describe("capability manifests", () => {
  it("refuses a validated capability with no conformance reference", () => {
    const refused = createCapability(capability({ support: "validated" }));
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.rejections[0]?.record.message).toContain("conformance reference");
  });

  it("admits a validated capability that cites its fixtures", () => {
    const admitted = createCapability(
      capability({ support: "validated", evidenceArtifactIds: ["art_conf_1"] }),
    );
    expect(admitted.ok).toBe(true);
  });

  it("requires a reason for a limited or unavailable capability", () => {
    const withoutReason = (extra: Partial<Capability>): Capability => {
      const { reason: _dropped, ...rest } = capability(extra);
      return rest as Capability;
    };
    expect(createCapability(withoutReason({ support: "limited" })).ok).toBe(false);
    expect(createCapability(withoutReason({ availability: "unavailable" })).ok).toBe(false);
  });
});

describe("support and availability are independent", () => {
  it("changes availability without touching the support level", () => {
    const stored = capability({ support: "validated", evidenceArtifactIds: ["art_conf_1"] });
    expect(effectiveAvailability(stored, { available: false })).toBe("unavailable");
    expect(effectiveAvailability(stored, { available: true })).toBe("immediate");
    expect(effectiveAvailability(stored, { available: true, queued: true })).toBe("queued");
    // The stored claim is untouched: a deployment change never rewrites it.
    expect(stored.support).toBe("validated");
  });

  it("keeps an unavailable capability unavailable while the deployment is up", () => {
    const stored = capability({ availability: "unavailable" });
    expect(effectiveAvailability(stored, { available: true })).toBe("unavailable");
  });
});

describe("missing capabilities", () => {
  it("names the missing feature rather than substituting a nearby one", () => {
    const explained = explainMissingCapability([capability()], "atomics");
    expect(explained.feature).toBe("atomics");
    expect(explained.reason).toContain("no nearby capability is substituted");
  });
});

describe("profile revisions", () => {
  it("pins its tool versions", () => {
    expect(createProfileRevision(revision).ok).toBe(true);
    expect(createProfileRevision({ ...revision, components: [] }).ok).toBe(false);
  });

  it("derives a stable revision hash from the record", () => {
    const { revisionHash: _hash, ...withoutHash } = revision;
    const first = revisionHashOf(withoutHash);
    const second = revisionHashOf({ ...withoutHash });
    expect(first).toBe(second);
    expect(first).not.toBe(revision.revisionHash);
  });
});
