/** Declarative command registry; strict arguments and structured boundary errors. */
import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { analyze } from "./commands/analyze.js";
import { serve } from "./commands/serve.js";
import { compare } from "./commands/compare.js";
import { exportBundle, importBundle } from "./commands/bundle.js";
import { EXIT_ERROR } from "./report.js";

export interface CommandContext {
  readonly argv: readonly string[];
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}
export interface Command {
  readonly name: string;
  readonly summary: string;
  readonly run: (context: CommandContext) => Promise<number> | number;
}

function args(argv: readonly string[], strings: readonly string[], booleans: readonly string[] = []): Record<string, string | boolean | undefined> {
  const options = Object.fromEntries([...strings.map((name) => [name, { type: "string" as const }]), ...booleans.map((name) => [name, { type: "boolean" as const }])]);
  const parsed = parseArgs({ args: [...argv], options, strict: true, allowPositionals: false }).values;
  const values: Record<string, string | boolean | undefined> = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (typeof value !== "string" && typeof value !== "boolean" && value !== undefined) throw new Error("INPUT_INVALID: repeated option values are not supported");
    values[name] = value;
  }
  return values;
}
function required(value: string | boolean | undefined, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`INPUT_INVALID: ${name} is required`);
  return value;
}
function output(document: unknown, path: string | boolean | undefined, stdout: (line: string) => void): void {
  const text = JSON.stringify(document, null, 2);
  if (typeof path === "string") writeFileSync(path, text + "\n", { mode: 0o600 });
  else stdout(text);
}
async function analysisCommand({ argv }: CommandContext) {
  const values = args(argv, ["scenario", "manifest", "report", "solver-time-ms", "profile"], ["trust-local-code"]);
  if (values["scenario"] && values["manifest"]) throw new Error("INPUT_INVALID: select either --scenario or --manifest");
  return analyze({ scenarioPath: required(values["scenario"] ?? values["manifest"], "--scenario or --manifest"),
    ...(typeof values["report"] === "string" ? { reportPath: values["report"] } : {}),
    ...(typeof values["profile"] === "string" ? { profileRevisionId: values["profile"] } : {}),
    ...(typeof values["solver-time-ms"] === "string" ? { solverTimeMs: Number(values["solver-time-ms"]) } : {}),
    // Consent is per invocation. It is passed through, never remembered.
    trustLocalCode: values["trust-local-code"] === true });
}

export const COMMANDS: readonly Command[] = [
  { name: "analyze", summary: "analyze immutable source under a measured local profile", run: analysisCommand },
  { name: "validate", summary: "check every declared required property", run: analysisCommand },
  { name: "serve", summary: "browse captured evidence read-only on loopback", async run({ argv, stdout }) {
    const values = args(argv, ["report", "port"]);
    const served = await serve({ ...(typeof values["report"] === "string" ? { reportPath: values["report"] } : {}),
      ...(typeof values["port"] === "string" ? { port: Number(values["port"]) } : {}) });
    stdout(`pomset: read-only viewer at ${served.url}`);
    await new Promise<void>(() => {});
    return 0;
  } },
  { name: "compare", summary: "compare two named snapshots under compatible domains and profiles", run({ argv, stdout }) {
    const values = args(argv, ["baseline", "current", "report"]);
    const compared = compare(required(values["baseline"], "--baseline"), required(values["current"], "--current"));
    output(compared.document, values["report"], stdout);
    return compared.status;
  } },
  { name: "export", summary: "export portable evidence and captured source bytes", run({ argv, stdout }) {
    const values = args(argv, ["report", "out"]);
    const bundle = exportBundle(required(values["report"], "--report"), required(values["out"], "--out"));
    stdout(JSON.stringify({ bundleId: bundle.bundleId, manifestHash: bundle.manifestHash, published: false }));
    return 0;
  } },
  { name: "import", summary: "validate and privately ingest a directory bundle without execution", run({ argv, stdout }) {
    const values = args(argv, ["bundle", "workspace"]);
    const bundle = importBundle(required(values["bundle"], "--bundle"), required(values["workspace"], "--workspace"));
    stdout(JSON.stringify({ bundleId: bundle.bundleId, origin: "imported", published: false }));
    return 0;
  } },
  { name: "benchmark", summary: "requires eligible validation, consent and a compatible measurement backend", run({ argv }) {
    const values = args(argv, ["validation", "report"], ["trust-local-code"]);
    if (!values["trust-local-code"]) throw new Error("INPUT_INVALID: benchmark requires --trust-local-code for this invocation");
    required(values["validation"], "--validation");
    throw new Error("INPUT_INVALID: no conformed benchmark runner is available in this build; no timing was fabricated");
  } },
];

export async function runCli(argv: readonly string[]): Promise<number> {
  const [name, ...rest] = argv;
  const stdout = (line: string) => process.stdout.write(`${line}\n`);
  const stderr = (line: string) => process.stderr.write(`${line}\n`);
  if (!name || name === "--help" || name === "-h") {
    stdout("pomset — parallel behaviour explorer\nUsage: pomset <command> [options]\n");
    for (const command of COMMANDS) stdout(`  ${command.name.padEnd(10)} ${command.summary}`);
    return name ? 0 : EXIT_ERROR;
  }
  try {
    const command = COMMANDS.find((candidate) => candidate.name === name);
    if (!command) throw new Error(`INPUT_INVALID: unknown command ${name}`);
    return await command.run({ argv: rest, stdout, stderr });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.startsWith("BUNDLE_INVALID:") ? "BUNDLE_INVALID" : message.startsWith("PROFILE_NOT_FOUND:") ? "PROFILE_NOT_FOUND" : "INPUT_INVALID";
    stderr(JSON.stringify({ schemaVersion: 1, error: { code, message } }));
    return EXIT_ERROR;
  }
}
