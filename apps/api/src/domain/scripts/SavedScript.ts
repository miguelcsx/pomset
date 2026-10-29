/**
 * A script a signed-in user keeps, and the rules its fields must satisfy.
 *
 * The scenario is stored as the JSON object the workbench produced. It is
 * bounded by size rather than by shape: the canonical scenario contract is
 * enforced by the workbench when it runs, and a saved copy only has to be a
 * bounded JSON object.
 */

import { badRequest } from "../errors/ApplicationError.js";
import { hasControlCharacter } from "../text.js";

export const TITLE_MAX_LENGTH = 120;
export const SOURCE_MAX_BYTES = 1_000_000;
export const SCENARIO_MAX_BYTES = 64 * 1024;

export type Scenario = Readonly<Record<string, unknown>>;

export interface ScriptInput {
  readonly title: string;
  readonly source: string;
  readonly scenario: Scenario | null;
}

/** A partial update: only the fields the caller sent are present. */
export type ScriptPatch = Partial<ScriptInput>;

export interface SavedScript extends ScriptInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A script as a list shows it: the source is fetched only when opened. */
export type ScriptSummary = Pick<SavedScript, "id" | "title" | "createdAt" | "updatedAt">;

type Fields = Record<string, string>;

export function parseScriptInput(input: unknown): ScriptInput {
  const body = asObject(input);
  const fields: Fields = {};
  const title = titleOf(body["title"], fields);
  const source = sourceOf(body["source"], fields);
  const scenario = scenarioOf(body["scenario"], fields);
  refuseIfAny(fields);
  return { title: title!, source: source!, scenario: scenario ?? null };
}

export function parseScriptPatch(input: unknown): ScriptPatch {
  const body = asObject(input);
  const fields: Fields = {};
  const title = "title" in body ? titleOf(body["title"], fields) : undefined;
  const source = "source" in body ? sourceOf(body["source"], fields) : undefined;
  const scenario = "scenario" in body ? (scenarioOf(body["scenario"], fields) ?? null) : undefined;
  refuseIfAny(fields);

  const patch: { -readonly [K in keyof ScriptPatch]: ScriptPatch[K] } = {};
  if (title !== undefined) patch.title = title;
  if (source !== undefined) patch.source = source;
  if (scenario !== undefined) patch.scenario = scenario;
  if (Object.keys(patch).length === 0)
    throw badRequest("Send at least one field to change", { fields: { title: "Send a field" } });
  return patch;
}

/** Stored scenarios are JSON text. The conversion lives beside the rule that bounds it. */
export function encodeScenario(scenario: Scenario | null): string | null {
  return scenario === null ? null : JSON.stringify(scenario);
}

export function decodeScenario(text: string | null): Scenario | null {
  return text === null ? null : (JSON.parse(text) as Scenario);
}

function titleOf(value: unknown, fields: Fields): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    fields["title"] = "Enter a title";
    return undefined;
  }
  const title = value.trim();
  if (title.length > TITLE_MAX_LENGTH) {
    fields["title"] = `Use at most ${TITLE_MAX_LENGTH} characters`;
    return undefined;
  }
  if (hasControlCharacter(title)) {
    fields["title"] = "Remove the control characters";
    return undefined;
  }
  return title;
}

function sourceOf(value: unknown, fields: Fields): string | undefined {
  if (typeof value !== "string") {
    fields["source"] = "Send the script source as text";
    return undefined;
  }
  if (Buffer.byteLength(value, "utf8") > SOURCE_MAX_BYTES) {
    fields["source"] = `Use at most ${SOURCE_MAX_BYTES} bytes`;
    return undefined;
  }
  return value;
}

function scenarioOf(value: unknown, fields: Fields): Scenario | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    fields["scenario"] = "Send the scenario as an object";
    return undefined;
  }
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, "utf8") > SCENARIO_MAX_BYTES) {
    fields["scenario"] = `Use at most ${SCENARIO_MAX_BYTES / 1024} KB`;
    return undefined;
  }
  return value as Scenario;
}

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw badRequest("Send a JSON object");
  return input as Record<string, unknown>;
}

function refuseIfAny(fields: Fields): void {
  if (Object.keys(fields).length > 0)
    throw badRequest("Some fields need correcting", { fields });
}
