#!/usr/bin/env node
/**
 * The single generator for the canonical contracts.
 *
 * `schema/*.schema.yaml` plus `schema/openapi.yaml` are the one authority. This
 * script reads the JSON Schemas, resolves every local `$ref`, and emits both the
 * TypeScript and the Python bindings from one intermediate representation, so
 * the two ecosystems cannot drift and no second codegen toolchain is needed
 * offline. It also emits the single `ErrorCode` registry and the closed
 * outcome x method x evidenceClass table, which the schema only partially
 * encodes as `if`/`then` conditions.
 *
 * Several schemas redefine a shared primitive (`id`, `sha256`, `path`,
 * `schemaVersion`, `method`, `propertyId`, `errorCode`, `errorRecord`). Those are
 * emitted once, into `primitives`, when their bodies are byte-identical, and a
 * difference between two definitions of the same name is a hard error rather
 * than a silent shadow.
 *
 * Run it plain to regenerate, or with `--check` to fail when the committed
 * bindings are stale — the drift gate CI runs.
 *
 * Only erasable TypeScript syntax is used, so `node scripts/generate.ts` runs it
 * without a build step.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const schemaDir = join(packageRoot, "schema");
const tsOutDir = join(packageRoot, "src", "generated");
const pyOutDir = join(packageRoot, "python", "pomset_contracts", "generated");
const tuplesPath = join(packageRoot, "tuples.json");

/** The schema files, in the order their generated modules are listed. */
const SCHEMAS = [
  "domain",
  "evidence",
  "measurement",
  "engine",
  "publication",
  "bundle",
] as const;

type Json = Record<string, unknown>;
type Def = Json;

interface SchemaFile {
  readonly name: string;
  readonly defs: Map<string, Def>;
}

/** `propertyResult` -> `PropertyResult`; `id` -> `Id`. */
function pascal(name: string): string {
  const parts = name
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/);
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

/** A key-order-independent serialisation, for structural comparison. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const entries = Object.entries(value as Json)
    .filter(([key]) => key !== "$comment" && key !== "description")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json;
}

/** The schemas are YAML, which is a superset of JSON: one parser reads both. */
function readYaml(path: string): Json {
  return parseYaml(readFileSync(path, "utf8")) as Json;
}

/**
 * Hoists every inline object that carries `properties` into a named definition,
 * so both emitters see a flat, named type space. The name is derived from the
 * path that reached it (`jobEvent` + `progress` -> `JobEventProgress`).
 */
function hoist(name: string, node: unknown, defs: Map<string, Def>, suffix: string): void {
  if (Array.isArray(node)) {
    node.forEach((entry) => hoist(name, entry, defs, suffix));
    return;
  }
  if (node === null || typeof node !== "object") return;
  const schema = node as Json;

  for (const key of ["anyOf", "oneOf", "allOf"]) {
    const branches = schema[key];
    if (Array.isArray(branches)) {
      // Conditional branches (`if`/`then`) are not hoisted: their bodies are
      // validation rules, not new named shapes.
      if (key === "allOf") {
        branches.filter((b) => !(b as Json)?.if).forEach((b) => hoist(name, b, defs, suffix));
      } else {
        branches.forEach((b) => hoist(name, b, defs, suffix));
      }
    }
  }
  if (schema.items) hoist(name, schema.items, defs, `${suffix}Item`);
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    hoist(name, schema.additionalProperties, defs, `${suffix}Value`);
  }

  const properties = schema.properties;
  if (properties && typeof properties === "object") {
    for (const [prop, value] of Object.entries(properties as Json)) {
      const child = value as Json;
      const childName = `${name}${pascal(prop)}`;
      if (
        child &&
        typeof child === "object" &&
        (child.properties || child.anyOf || child.oneOf || child.allOf)
      ) {
        if (!defs.has(childName)) {
          defs.set(childName, child);
          hoist(childName, child, defs, "");
        }
      } else {
        hoist(name, child, defs, pascal(prop));
      }
    }
  }
}

function loadSchemas(): SchemaFile[] {
  const files = SCHEMAS.map((name) => {
    const raw = readYaml(join(schemaDir, `${name}.schema.yaml`));
    const defs = new Map<string, Def>();
    const rawDefs = (raw.$defs ?? {}) as Record<string, Def>;
    for (const [defName, def] of Object.entries(rawDefs)) defs.set(defName, def);
    for (const [defName, def] of Object.entries(rawDefs)) hoist(defName, def, defs, "");
    return { name, defs };
  });

  // A definition name that means different things in different schemas is kept
  // per file under a qualified name (`DomainPath`, `EnginePath`) rather than
  // silently merged; the schemas really do define two path patterns.
  const bodies = new Map<string, Set<string>>();
  for (const file of files) {
    for (const [defName, def] of file.defs) {
      const set = bodies.get(defName) ?? new Set<string>();
      set.add(stableStringify(def));
      bodies.set(defName, set);
    }
  }
  const conflicting = new Set(
    [...bodies.entries()].filter(([, set]) => set.size > 1).map(([name]) => name),
  );
  if (conflicting.size === 0) return files;

  for (const file of files) {
    const renames = new Map<string, string>();
    for (const name of conflicting) {
      if (file.defs.has(name)) renames.set(name, `${pascal(file.name)}${pascal(name)}`);
    }
    if (renames.size === 0) continue;
    const renamed = new Map<string, Def>();
    for (const [defName, def] of file.defs) {
      renamed.set(renames.get(defName) ?? defName, rewriteRefs(def, renames));
    }
    file.defs.clear();
    for (const [defName, def] of renamed) file.defs.set(defName, def);
  }
  return files;
}

/** Deep-clones a schema node, redirecting the renamed `$ref`s. */
function rewriteRefs(node: unknown, renames: Map<string, string>): unknown {
  if (Array.isArray(node)) return node.map((entry) => rewriteRefs(entry, renames));
  if (node === null || typeof node !== "object") return node;
  const out: Json = {};
  for (const [key, value] of Object.entries(node as Json)) {
    if (key === "$ref" && typeof value === "string") {
      const target = refName(value);
      out[key] = renames.has(target) ? `#/$defs/${renames.get(target)}` : value;
    } else {
      out[key] = rewriteRefs(value, renames);
    }
  }
  return out;
}

/**
 * Definitions that the hand-written registries own and the schema emitter must
 * not duplicate: the error vocabulary lives in `errors.ts` and `errors.py`.
 */
const REGISTRY_OWNED = new Set(["errorCode", "errorRecord"]);

/**
 * Splits definitions into the ones several schemas share (emitted once, in
 * `primitives`) and the ones local to a file. Two definitions of the same name
 * with different bodies are refused.
 */
function partition(files: SchemaFile[]): {
  shared: Map<string, Def>;
  local: Map<string, Map<string, Def>>;
} {
  const seen = new Map<string, { body: string; def: Def }>();
  const shared = new Map<string, Def>();
  const local = new Map<string, Map<string, Def>>();

  for (const file of files) {
    local.set(file.name, new Map());
    for (const [defName, def] of file.defs) {
      if (REGISTRY_OWNED.has(defName)) continue;
      const body = stableStringify(def);
      const prior = seen.get(defName);
      if (prior) {
        if (prior.body !== body) {
          throw new Error(
            `$defs/${defName} differs between schemas; one name must mean one shape`,
          );
        }
        shared.set(defName, def);
      } else {
        seen.set(defName, { body, def });
      }
    }
  }

  for (const file of files) {
    for (const [defName] of file.defs) {
      if (REGISTRY_OWNED.has(defName)) continue;
      if (!shared.has(defName)) local.get(file.name)?.set(defName, file.defs.get(defName) as Def);
    }
  }
  return { shared, local };
}

function refName(ref: string): string {
  return ref.replace("#/$defs/", "");
}

function literal(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new Error(`unsupported literal ${JSON.stringify(value)}`);
}

function safeKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function safePyKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : `**{"${key}": ...}`;
}

/** The TypeScript type for a schema node. */
function tsType(node: unknown): string {
  if (node === true || node === null || typeof node !== "object") return "unknown";
  const schema = node as Json;

  if (typeof schema.$ref === "string") return pascal(refName(schema.$ref));
  if (schema.anyOf || schema.oneOf) {
    const branches = (schema.anyOf ?? schema.oneOf) as unknown[];
    return [...new Set(branches.map((b) => tsType(b)))].join(" | ");
  }
  if (Array.isArray(schema.allOf)) {
    const typed = schema.allOf
      .filter((b) => b && typeof b === "object" && !(b as Json).if)
      .map((b) => tsType(b))
      .filter((t) => t !== "unknown");
    if (typed.length > 0) return [...new Set(typed)].join(" & ");
    if (schema.properties) return tsObject(schema);
    return "unknown";
  }
  if (schema.enum) return (schema.enum as unknown[]).map(literal).join(" | ");
  if ("const" in schema) return literal(schema.const);
  if (Array.isArray(schema.type)) {
    return [...new Set((schema.type as string[]).map((t) => tsType({ ...schema, type: t })))].join(
      " | ",
    );
  }

  switch (schema.type) {
    case "object":
      return tsObject(schema);
    case "array": {
      const items = schema.items ? tsType(schema.items) : "unknown";
      const inner = items.includes("|") || items.includes("&") ? `(${items})` : items;
      return `readonly ${inner}[]`;
    }
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}

function tsObject(schema: Json): string {
  const properties = (schema.properties ?? {}) as Record<string, unknown>;
  const required = new Set((schema.required ?? []) as string[]);
  const keys = Object.keys(properties);
  if (keys.length === 0) return "Readonly<Record<string, unknown>>";
  const body = keys
    .map(
      (key) =>
        `readonly ${safeKey(key)}${required.has(key) ? "" : "?"}: ${tsType(properties[key])};`,
    )
    .join(" ");
  return `{ ${body} }`;
}

/** The Python type for a schema node. */
function pyType(node: unknown): string {
  if (node === true || node === null || typeof node !== "object") return "Any";
  const schema = node as Json;

  if (typeof schema.$ref === "string") return pascal(refName(schema.$ref));
  if (schema.anyOf || schema.oneOf) {
    const branches = (schema.anyOf ?? schema.oneOf) as unknown[];
    return [...new Set(branches.map((b) => pyType(b)))].join(" | ");
  }
  if (Array.isArray(schema.allOf)) {
    const typed = schema.allOf
      .filter((b) => b && typeof b === "object" && !(b as Json).if)
      .map((b) => pyType(b))
      .filter((t) => t !== "Any");
    if (typed.length > 0) return typed[0] as string;
    return "dict[str, Any]";
  }
  if (schema.enum) return `Literal[${(schema.enum as unknown[]).map(literal).join(", ")}]`;
  if ("const" in schema) return `Literal[${literal(schema.const)}]`;
  if (Array.isArray(schema.type)) {
    return [...new Set((schema.type as string[]).map((t) => pyType({ ...schema, type: t })))].join(
      " | ",
    );
  }

  switch (schema.type) {
    case "object":
      return "dict[str, Any]";
    case "array": {
      const items = schema.items ? pyType(schema.items) : "Any";
      return `list[${items}]`;
    }
    case "string":
      return "str";
    case "integer":
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "null":
      return "None";
    default:
      return "Any";
  }
}

function emitTsDef(typeName: string, schema: Json): string {
  if (schema.enum) {
    // An enum is emitted as a merged const and type, so the permitted values
    // exist at run time as well as in the type system from one declaration.
    const values = (schema.enum as unknown[]).map(literal).join(", ");
    return [
      `export const ${typeName} = [${values}] as const;`,
      `export type ${typeName} = (typeof ${typeName})[number];`,
    ].join("\n");
  }
  if ("const" in schema && typeof schema.const !== "object") {
    return [
      `export const ${typeName} = ${literal(schema.const)} as const;`,
      `export type ${typeName} = typeof ${typeName};`,
    ].join("\n");
  }
  if (schema.type === "object" && schema.properties) {
    const required = new Set((schema.required ?? []) as string[]);
    const lines = [`export interface ${typeName} {`];
    for (const key of Object.keys(schema.properties as Json)) {
      const optional = required.has(key) ? "" : "?";
      lines.push(
        `  readonly ${safeKey(key)}${optional}: ${tsType((schema.properties as Json)[key])};`,
      );
    }
    lines.push("}");
    return lines.join("\n");
  }
  return `export type ${typeName} = ${tsType(schema)};`;
}

function emitPyDef(typeName: string, schema: Json): string {
  if (schema.type === "object" && schema.properties) {
    const required = new Set((schema.required ?? []) as string[]);
    const lines = [`class ${typeName}(TypedDict):`];
    const props = Object.keys(schema.properties as Json);
    if (props.length === 0) lines.push("    pass");
    for (const key of props) {
      const type = pyType((schema.properties as Json)[key]);
      lines.push(`    ${safePyKey(key)}: ${required.has(key) ? type : `NotRequired[${type}]`}`);
    }
    return lines.join("\n");
  }
  return `${typeName} = ${pyType(schema)}`;
}

function tsHeader(comment: string): string[] {
  return ["// Generated by packages/contracts/scripts/generate.ts. Do not edit.", comment, ""];
}

function pyHeader(comment: string): string[] {
  return [
    '"""Generated by packages/contracts/scripts/generate.ts. Do not edit.',
    "",
    comment,
    '"""',
    "",
    "from __future__ import annotations",
    "",
    "from typing import Any, Literal, NotRequired, TypedDict",
    "",
  ];
}

/**
 * Orders definitions so Python can evaluate them where they are written.
 *
 * `from __future__ import annotations` defers annotations, not assignments:
 * `LaunchConfig = ProgramInstanceLaunch | HostThreadsLaunch` is evaluated at the
 * line it appears on, so a union of `$ref`s must follow the definitions it
 * names. Classes go first — their bodies are annotations and therefore lazy —
 * and the remaining aliases follow in dependency order.
 */
function orderForPython(defs: readonly (readonly [string, Def])[]): (readonly [string, Def])[] {
  const isClass = (def: Def): boolean => def.type === "object" && Boolean(def.properties);
  const classes = defs.filter(([, def]) => isClass(def));
  const names = new Set(defs.map(([name]) => pascal(name)));
  const emitted = new Set(classes.map(([name]) => pascal(name)));

  /** Every capitalised name the emitted type mentions; only `$ref`s matter. */
  const references = (def: Def): string[] =>
    [...pyType(def).matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)].map((match) => match[0]);

  const remaining = defs.filter(([, def]) => !isClass(def));
  const ordered: (readonly [string, Def])[] = [];
  while (remaining.length > 0) {
    const at = remaining.findIndex(([, def]) =>
      references(def).every((name) => !names.has(name) || emitted.has(name)),
    );
    // A cycle would have no ready entry; emit one rather than loop forever, and
    // the generated file still names what it cannot order.
    const [item] = remaining.splice(at >= 0 ? at : 0, 1) as [(readonly [string, Def])];
    ordered.push(item);
    emitted.add(pascal(item[0]));
  }
  return [...classes, ...ordered];
}

/** Reads and cross-checks the two copies of the error code enum. */
function emitErrors(files: SchemaFile[]): { ts: string; py: string } {
  const enums: string[][] = [];
  for (const [file, def] of [
    ["evidence", "errorCode"],
    ["engine", "errorCode"],
  ] as const) {
    const node = files.find((f) => f.name === file)?.defs.get(def) as Json | undefined;
    if (!node?.enum) throw new Error(`${file}#/$defs/${def} has no enum`);
    enums.push(node.enum as string[]);
  }
  const [first, second] = enums;
  if (!first || !second) throw new Error("error code enum not found");
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("the two errorCode enums disagree; one vocabulary only");
  }
  if (first.length !== 8) {
    throw new Error(`ErrorCode must contain exactly 8 codes, found ${first.length}`);
  }
  const codes = first;

  const statuses: [string, number][] = [
    ["PROFILE_NOT_FOUND", 404],
    ["INPUT_INVALID", 400],
    ["PROTOCOL_INVALID", 400],
    ["BUNDLE_INVALID", 422],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["ENGINE_FAILED", 500],
    ["WORKER_LOST", 500],
  ];

  const ts = [
    ...tsHeader(
      "// One error vocabulary, shared by HTTP responses, engine error payloads, job\n" +
        "// failures and CLI reports. Unsupported and unknown analysis outcomes are not\n" +
        "// error codes.",
    ),
    `export const ERROR_CODES = [\n${codes.map((c) => `  ${JSON.stringify(c)},`).join("\n")}\n] as const;`,
    "",
    "export type ErrorCode = (typeof ERROR_CODES)[number];",
    "",
    "export interface ErrorRecord {",
    "  readonly code: ErrorCode;",
    "  readonly message: string;",
    "  readonly details?: Readonly<Record<string, unknown>>;",
    "}",
    "",
    "/** The synchronous HTTP status for each synchronous error code. */",
    "export const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {",
    ...statuses.map(([code, status]) => `  ${code}: ${status},`),
    "};",
    "",
  ].join("\n");

  const py = [
    ...pyHeader("One error vocabulary."),
    "",
    "from enum import StrEnum",
    "",
    "",
    "class ErrorCode(StrEnum):",
    ...codes.map((c) => `    ${c} = ${JSON.stringify(c)}`),
    "",
    "",
    "HTTP_STATUS: dict[ErrorCode, int] = {",
    ...statuses.map(([code, status]) => `    ErrorCode.${code}: ${status},`),
    "}",
    "",
    "",
    "class ErrorRecord(TypedDict):",
    "    code: ErrorCode",
    "    message: str",
    "    details: NotRequired[dict[str, Any]]",
    "",
  ].join("\n");

  return { ts, py };
}

/** Emits the closed outcome x method x evidenceClass table from tuples.json. */
function emitTuples(files: SchemaFile[]): { ts: string; py: string } {
  const table = readJson(tuplesPath) as {
    outcome: string[];
    method: string[];
    evidenceClass: string[];
    allowed: [string, string[], string[]][];
  };

  const result = files.find((f) => f.name === "evidence")?.defs.get("propertyResult") as
    | Json
    | undefined;

  // The tuples table names the same three enums the schemas define. Refuse a
  // table that has drifted from them.
  const evidence = files.find((f) => f.name === "evidence");
  const expected: [string, string[]][] = [
    ["outcome", table.outcome],
    ["method", table.method],
    ["evidenceClass", table.evidenceClass],
  ];
  for (const [defName, values] of expected) {
    const node = evidence?.defs.get(defName) as Json | undefined;
    const enumValues = (node?.enum as string[] | undefined) ?? [];
    if (JSON.stringify(enumValues) !== JSON.stringify(values)) {
      throw new Error(
        `tuples.json ${defName} does not match evidence.schema.yaml#/$defs/${defName}`,
      );
    }
  }

  if (result?.allOf) {
    const referenced = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node === null || typeof node !== "object") return;
      const schema = node as Json;
      if (typeof schema.const === "string") referenced.add(schema.const);
      if (Array.isArray(schema.enum)) (schema.enum as string[]).forEach((v) => referenced.add(v));
      Object.values(schema).forEach(walk);
    };
    walk(result.allOf);
    for (const [outcome, , classes] of table.allowed) {
      if (outcome === "unknown" || outcome === "unsupported") continue;
      for (const cls of classes) {
        if (!referenced.has(cls)) {
          throw new Error(
            `tuples.json claims ${outcome} x ${cls}, which propertyResult.allOf does not reference`,
          );
        }
      }
    }
  }

  const ts = [
    ...tsHeader(
      "// The permitted combinations of property outcome, method and evidence class\n" +
        "// Every other combination is rejected as INPUT_INVALID; the\n" +
        "// only constructor path is packages/domain's result module.",
    ),
    'import type { Method } from "./generated/primitives.js";',
    'import type { EvidenceClass, Outcome } from "./generated/evidence.js";',
    "",
    "/** Each entry is [outcome, permitted methods, permitted evidence classes]. */",
    "export const ALLOWED_TUPLES: readonly (readonly [Outcome, readonly Method[], readonly EvidenceClass[]])[] = [",
    ...table.allowed.map(
      ([outcome, methods, classes]) =>
        `  [${JSON.stringify(outcome)}, [${methods.map((m) => JSON.stringify(m)).join(", ")}], [${classes.map((c) => JSON.stringify(c)).join(", ")}]],`,
    ),
    "];",
    "",
    "/** True when the combination is one the contract admits. */",
    "export function isAllowedTuple(outcome: Outcome, method: Method, evidenceClass: EvidenceClass): boolean {",
    "  return ALLOWED_TUPLES.some(",
    "    ([o, methods, classes]) =>",
    "      o === outcome && methods.includes(method) && classes.includes(evidenceClass),",
    "  );",
    "}",
    "",
  ].join("\n");

  const py = [
    ...pyHeader("The closed outcome x method x evidenceClass table."),
    `Outcome = Literal[${table.outcome.map((v) => JSON.stringify(v)).join(", ")}]`,
    `Method = Literal[${table.method.map((v) => JSON.stringify(v)).join(", ")}]`,
    `EvidenceClass = Literal[${table.evidenceClass.map((v) => JSON.stringify(v)).join(", ")}]`,
    "",
    "# (outcome, permitted methods, permitted evidence classes)",
    "ALLOWED_TUPLES: tuple[tuple[str, tuple[str, ...], tuple[str, ...]], ...] = (",
    ...table.allowed.map(
      ([outcome, methods, classes]) =>
        `    (${JSON.stringify(outcome)}, (${methods.map((m) => JSON.stringify(m)).join(", ")}), (${classes.map((c) => JSON.stringify(c)).join(", ")})),`,
    ),
    ")",
    "",
    "",
    "def is_allowed_tuple(outcome: str, method: str, evidence_class: str) -> bool:",
    '    """True when the combination is one the contract admits."""',
    "    return any(",
    "        o == outcome and method in methods and evidence_class in classes",
    "        for o, methods, classes in ALLOWED_TUPLES",
    "    )",
    "",
  ].join("\n");

  return { ts, py };
}

/** Builds every output file's content, keyed by absolute path. */
function buildOutputs(): Map<string, string> {
  const files = loadSchemas();
  const { shared, local } = partition(files);
  const outputs = new Map<string, string>();
  const documents = Object.fromEntries(SCHEMAS.map((name) => {
    const document = parseYaml(readFileSync(join(schemaDir, `${name}.schema.yaml`), "utf8")) as Json;
    return [String(document["$id"]), document];
  }));
  outputs.set(join(tsOutDir, "schemas.ts"), `// Generated from canonical schemas. Do not edit.\nexport const DOCUMENTS: Record<string, Record<string, unknown>> = ${JSON.stringify(documents)};\n`);

  // Shared primitives, emitted once.
  const sharedNames = [...shared.keys()].sort();
  outputs.set(
    join(tsOutDir, "primitives.ts"),
    [
      ...tsHeader("// Definitions several schemas share, emitted once."),
      ...sharedNames.map((n) => emitTsDef(pascal(n), shared.get(n) as Def)),
      "",
    ].join("\n\n"),
  );
  outputs.set(
    join(pyOutDir, "primitives.py"),
    [
      ...pyHeader("Definitions several schemas share, emitted once."),
      "",
      ...orderForPython(sharedNames.map((n) => [n, shared.get(n) as Def] as const)).map(([n, d]) =>
        emitPyDef(pascal(n), d),
      ),
    ].join("\n\n") + "\n",
  );

  for (const file of files) {
    const defs = [...(local.get(file.name) as Map<string, Def>).entries()];
    const tsImports =
      sharedNames.length > 0
        ? `import type { ${sharedNames.map(pascal).join(", ")} } from "./primitives.js";\n`
        : "";
    const tsBody = defs.map(([n, d]) => emitTsDef(pascal(n), d)).join("\n\n");
    // The error vocabulary is owned by src/errors.ts, so a module that names it
    // imports it rather than re-declaring it.
    const errorNames = ["ErrorCode", "ErrorRecord"].filter((n) => tsBody.includes(n));
    const errorImport =
      errorNames.length > 0 ? `import type { ${errorNames.join(", ")} } from "../errors.js";\n` : "";
    outputs.set(
      join(tsOutDir, `${file.name}.ts`),
      [
        ...tsHeader(`// Source: packages/contracts/schema/${file.name}.schema.yaml`),
        `${errorImport}${tsImports}\n${tsBody}`,
        "",
      ].join("\n"),
    );

    const pyImports =
      sharedNames.length > 0
        ? `from .primitives import (  # noqa: F401\n${sharedNames.map((n) => `    ${pascal(n)},`).join("\n")}\n)\n`
        : "";
    const pyBody = orderForPython(defs).map(([n, d]) => emitPyDef(pascal(n), d)).join("\n\n");
    const pyErrorNames = ["ErrorCode", "ErrorRecord"].filter((n) => pyBody.includes(n));
    const pyErrorImport =
      pyErrorNames.length > 0 ? `from .errors import ${pyErrorNames.join(", ")}  # noqa: F401\n` : "";
    outputs.set(
      join(pyOutDir, `${file.name}.py`),
      [
        ...pyHeader(`Source: packages/contracts/schema/${file.name}.schema.yaml`),
        "",
        `${pyErrorImport}${pyImports}\n${pyBody}`,
        "",
      ].join("\n"),
    );
  }

  outputs.set(
    join(tsOutDir, "index.ts"),
    [
      ...tsHeader("// The generated bindings, re-exported."),
      `export * from "./primitives.js";`,
      ...SCHEMAS.map((name) => `export * from "./${name}.js";`),
      "",
    ].join("\n"),
  );
  outputs.set(
    join(pyOutDir, "__init__.py"),
    [
      ...pyHeader("The generated bindings, re-exported."),
      "from . import (  # noqa: F401",
      ...["primitives", ...SCHEMAS].map((n) => `    ${n},`),
      ")",
      "",
    ].join("\n"),
  );

  const errors = emitErrors(files);
  outputs.set(join(packageRoot, "src", "errors.ts"), errors.ts);
  outputs.set(join(pyOutDir, "errors.py"), errors.py);

  const tuples = emitTuples(files);
  outputs.set(join(packageRoot, "src", "tuples.ts"), tuples.ts);
  outputs.set(join(pyOutDir, "tuples.py"), tuples.py);

  return outputs;
}

function main(): void {
  const check = process.argv.includes("--check");
  const outputs = buildOutputs();

  if (check) {
    const stale: string[] = [];
    for (const [path, content] of outputs) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== content) {
        stale.push(path.replace(`${packageRoot}/`, ""));
      }
    }
    if (stale.length > 0) {
      console.error(
        "generated bindings are stale; run `pnpm --filter @pomset/contracts run generate`:",
      );
      for (const path of stale) console.error(`  ${path}`);
      process.exit(1);
    }
    console.log(`contract bindings up to date (${outputs.size} files)`);
    return;
  }

  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(`generated ${outputs.size} binding files from ${SCHEMAS.length} schemas`);
}

main();
