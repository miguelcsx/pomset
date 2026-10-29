/**
 * A curated example in the catalog: a kernel, the scenario it is analysed under,
 * and the outcome that analysis is expected to show.
 *
 * Defects and controls are both kept. A check that only ever fires has not been
 * shown to stay quiet when it should, so the control is part of the evidence.
 * The scenario must be a canonical scenario, so it is checked against the
 * contract here rather than when someone first runs it.
 */

import { schemaSet } from "@pomset/contracts";

import { badRequest } from "../errors/ApplicationError.js";
import { SOURCE_MAX_BYTES, TITLE_MAX_LENGTH, type Scenario } from "../scripts/SavedScript.js";
import { hasControlCharacter } from "../text.js";

export const CATALOG_KINDS = ["defect", "control"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const SUMMARY_MAX_LENGTH = 300;
export const OUTCOME_MAX_LENGTH = 300;

export interface CatalogItemInput {
  readonly title: string;
  readonly summary: string;
  readonly kind: CatalogKind;
  readonly source: string;
  readonly scenario: Scenario;
  readonly expectedOutcome: string;
}

export interface CatalogItem extends CatalogItemInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A catalog item as a list shows it: the source and scenario are read on the detail page. */
export type CatalogSummary = Pick<CatalogItem, "id" | "title" | "summary" | "kind" | "createdAt" | "updatedAt">;

type Fields = Record<string, string>;

export function parseCatalogInput(input: unknown): CatalogItemInput {
  const body = asObject(input);
  const fields: Fields = {};
  const title = boundedText(body["title"], "title", TITLE_MAX_LENGTH, fields);
  const summary = boundedText(body["summary"], "summary", SUMMARY_MAX_LENGTH, fields);
  const expectedOutcome = boundedText(body["expectedOutcome"], "expectedOutcome", OUTCOME_MAX_LENGTH, fields);
  const kind = kindOf(body["kind"], fields);
  const source = sourceOf(body["source"], fields);
  const scenario = scenarioOf(body["scenario"], fields);
  if (Object.keys(fields).length > 0) throw badRequest("Some fields need correcting", { fields });
  return { title: title!, summary: summary!, kind: kind!, source: source!, scenario: scenario!, expectedOutcome: expectedOutcome! };
}

function boundedText(value: unknown, name: string, max: number, fields: Fields): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    fields[name] = "Enter a value";
    return undefined;
  }
  const text = value.trim();
  if (text.length > max) {
    fields[name] = `Use at most ${max} characters`;
    return undefined;
  }
  if (hasControlCharacter(text)) {
    fields[name] = "Remove the control characters";
    return undefined;
  }
  return text;
}

function kindOf(value: unknown, fields: Fields): CatalogKind | undefined {
  if (typeof value === "string" && (CATALOG_KINDS as readonly string[]).includes(value)) return value as CatalogKind;
  fields["kind"] = `Choose ${CATALOG_KINDS.join(" or ")}`;
  return undefined;
}

function sourceOf(value: unknown, fields: Fields): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    fields["source"] = "Send the kernel source as text";
    return undefined;
  }
  if (Buffer.byteLength(value, "utf8") > SOURCE_MAX_BYTES) {
    fields["source"] = `Use at most ${SOURCE_MAX_BYTES} bytes`;
    return undefined;
  }
  return value;
}

/** The scenario is the canonical contract, so a catalog entry is one the workbench can run. */
function scenarioOf(value: unknown, fields: Fields): Scenario | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fields["scenario"] = "Send the scenario as an object";
    return undefined;
  }
  const validate = schemaSet().validatorFor("domain.schema.yaml#/$defs/scenario");
  if (!validate(value)) {
    const first = validate.errors?.[0];
    fields["scenario"] = `${first?.instancePath || "scenario"} ${first?.message ?? "is not valid"}`;
    return undefined;
  }
  return value as Scenario;
}

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw badRequest("Send a JSON object");
  return input as Record<string, unknown>;
}
