/** Profile identity comes from the installed parser and solver, never a nearby catalogue entry. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalize, schemaSet, type ProfileRevision } from "@pomset/contracts";
import { selectEngine } from "./deployment.js";
const digest = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
export function probeProfile(directory: string, requestedId?: string): ProfileRevision {
  const selection = selectEngine();
  const raw: unknown = JSON.parse(execFileSync(selection.executable, ["-c", [
    "import json,sys,platform,z3,hashlib,pomset_triton",
    "from pathlib import Path",
    "from pomset_triton.protocol import ENGINE_VERSION",
    "digest=hashlib.sha256(b''.join(p.name.encode()+p.read_bytes() for p in sorted(Path(pomset_triton.__file__).parent.glob('*.py')))).hexdigest()",
    "print(json.dumps({'python':platform.python_version(),'engine':ENGINE_VERSION,'engineDigest':'sha256:'+digest,'z3':z3.get_version_string(),'os':sys.platform,'arch':platform.machine()}))",
  ].join("\n")], { encoding: "utf8", timeout: 10000, maxBuffer: 65536 }));
  if (!raw || typeof raw !== "object" || ["python", "engine", "engineDigest", "z3", "os", "arch"].some((key) => typeof (raw as Record<string, unknown>)[key] !== "string")) throw new Error("ENGINE_FAILED: invalid environment probe");
  const probe = raw as Record<string, string>;
  const id = `prf_${digest(JSON.stringify(probe)).slice(7)}`;
  if (requestedId && requestedId !== id) throw new Error(`PROFILE_NOT_FOUND: ${requestedId}; no profile was substituted`);
  const components = ["python", "engine", "z3"].map((name) => ({ name, version: probe[name]!, ...(name === "engine" ? { digest: probe["engineDigest"]! } : {}) }));
  const platform = { os: probe["os"]!, arch: probe["arch"]! };
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${id}.json`);
  if (existsSync(path)) {
    const saved: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!schemaSet().validatorFor("domain.schema.yaml#/$defs/profileRevision")(saved)) throw new Error("INPUT_INVALID: invalid cached profile");
    const profile = saved as ProfileRevision;
    const { revisionHash, ...record } = profile;
    if (revisionHash !== digest(canonicalize(record)) || profile.profileRevisionId !== id || profile.backend !== "triton" || canonicalize(profile.components) !== canonicalize(components) || canonicalize(profile.platform) !== canonicalize(platform) || profile.imageDigest || profile.capabilityIds.length) throw new Error("INPUT_INVALID: cached profile does not match actual runtime probes");
    return profile;
  }
  const record = { schemaVersion: 1 as const, profileRevisionId: id, backend: "triton" as const, createdAt: new Date().toISOString(), components, platform, capabilityIds: [], notes: "Measured interpreter/engine/solver identity. This probe does not validate capabilities." };
  const profile = { ...record, revisionHash: digest(canonicalize(record)) };
  writeFileSync(path, JSON.stringify(profile, null, 2) + "\n", { flag: "wx", mode: 0o444 });
  return profile;
}
