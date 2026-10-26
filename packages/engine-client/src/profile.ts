/** Profile identity comes from the installed parser and solver, never a nearby catalogue entry. */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalize, schemaSet, type ProfileRevision } from "@pomset/contracts";
import { selectEngine, type Backend } from "./deployment.js";

const digest = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

/** What the OpenMP probe measured, as it writes it. */
interface OpenmpProbe {
  readonly platform?: { readonly os?: string; readonly arch?: string };
  readonly compiler?: { readonly exitCode?: number | null; readonly stdout?: string } | null;
  readonly capabilities?: Readonly<Record<string, { readonly availability?: string }>>;
  readonly blocked?: string;
}

export function probeProfile(
  directory: string,
  requestedId?: string,
  backend: Backend = "triton",
): ProfileRevision {
  if (backend === "openmp") return probeOpenmp(directory, requestedId);
  if (backend !== "triton") {
    throw new Error(`PROFILE_NOT_FOUND: this deployment runs no local engine for ${backend}`);
  }
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

/**
 * The OpenMP profile is measured by the engine itself.
 *
 * That probe compiles and runs its own fixtures rather than reporting a version,
 * so this does not reimplement it in TypeScript: a second opinion about whether
 * a tool works would be a second answer, and the engine's is the one its results
 * are qualified by.
 */
function probeOpenmp(directory: string, requestedId?: string): ProfileRevision {
  const selection = selectEngine("openmp");
  const report = join(tmpdir(), `pomset-openmp-probe-${process.pid}-${Date.now()}.json`);
  try {
    spawnSync(
      selection.executable,
      ["-m", "pomset_openmp.profiles.probe", "--output", report],
      { encoding: "utf8", timeout: 120_000, cwd: selection.cwd },
    );
    if (!existsSync(report)) {
      throw new Error(
        "ENGINE_FAILED: the OpenMP probe wrote no report; run `uv sync --frozen` first",
      );
    }
    const measured = JSON.parse(readFileSync(report, "utf8")) as OpenmpProbe;
    const version = compilerVersion(measured);
    const instrumentation =
      measured.capabilities?.["instrumentedExecution"]?.availability ?? "unavailable";
    // `unresolved` is how an unprobed tool is recorded, and instrumentation that
    // cannot start here is exactly that: named, not given a version it never ran.
    const components = [
      { name: "clang", version: measured.compiler ? version : "unresolved" },
      {
        name: "thread-sanitizer",
        version: instrumentation === "immediate" ? version : "unresolved",
      },
    ];
    const platform = {
      os: measured.platform?.os ?? process.platform,
      arch: measured.platform?.arch ?? process.arch,
    };
    const probe = {
      clang: measured.compiler ? version : "unresolved",
      instrumentation,
      os: platform.os,
      arch: platform.arch,
    };
    const id = `prf_${digest(JSON.stringify(probe)).slice(7)}`;
    if (requestedId && requestedId !== id) {
      throw new Error(`PROFILE_NOT_FOUND: ${requestedId}; no profile was substituted`);
    }
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `${id}.json`);
    if (existsSync(path)) {
      const saved: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (!schemaSet().validatorFor("domain.schema.yaml#/$defs/profileRevision")(saved)) {
        throw new Error("INPUT_INVALID: invalid cached profile");
      }
      const cached = saved as ProfileRevision;
      const { revisionHash, ...rest } = cached;
      if (
        revisionHash !== digest(canonicalize(rest)) ||
        cached.profileRevisionId !== id ||
        cached.backend !== "openmp" ||
        canonicalize(cached.components) !== canonicalize(components) ||
        canonicalize(cached.platform) !== canonicalize(platform) ||
        cached.imageDigest ||
        cached.capabilityIds.length
      ) {
        throw new Error("INPUT_INVALID: cached profile does not match actual runtime probes");
      }
      return cached;
    }
    const record = {
      schemaVersion: 1 as const,
      profileRevisionId: id,
      backend: "openmp" as const,
      createdAt: new Date().toISOString(),
      components,
      platform,
      capabilityIds: [],
      notes:
        `Measured compiler identity and instrumentation availability (${instrumentation}). ` +
        "This probe does not validate capabilities: a version is a candidate, not a support claim.",
    };
    const profile = { ...record, revisionHash: digest(canonicalize(record)) };
    writeFileSync(path, JSON.stringify(profile, null, 2) + "\n", { flag: "wx", mode: 0o444 });
    return profile;
  } finally {
    rmSync(report, { force: true });
  }
}

/** The version clang reported, or a name for a compiler that would not say. */
function compilerVersion(measured: OpenmpProbe): string {
  const first = (measured.compiler?.stdout ?? "").split("\n").find((line) => line.trim());
  const token = first?.trim().split(/\s+/)[2];
  return token ?? "unresolved";
}
