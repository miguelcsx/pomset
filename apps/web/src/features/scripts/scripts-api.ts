/**
 * The signed-in user's scripts and the results saved against them. Every call
 * needs the account token; the API answers 401 without one, and `apiRequest`
 * refuses locally before a request is sent.
 */

import { apiRequest, unwrap } from "../common/http";
import { asObject, stringField, type JsonObject, UnexpectedResponse } from "../common/json";
import { pageQuery, parsePage, type Page } from "../common/page";

export interface ScriptSummary {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavedScript extends ScriptSummary {
  readonly source: string;
  readonly scenario: JsonObject | null;
}

export interface ScriptDraft {
  readonly title: string;
  readonly source: string;
  readonly scenario: JsonObject | null;
}

export interface SavedResultSummary {
  readonly id: string;
  readonly analysisId: string;
  readonly createdAt: string;
}

export interface SavedResult extends SavedResultSummary {
  readonly scriptId: string;
  readonly document: unknown;
}

export const SCRIPTS_PAGE_SIZE = 10;
/** The API's limit on a script title; the same bound applies in every form. */
export const TITLE_MAX = 120;

function scenarioField(record: JsonObject): JsonObject | null {
  const value = record["scenario"];
  if (value === null || value === undefined) return null;
  return asObject(value);
}

export function parseSummary(value: unknown): ScriptSummary {
  const record = asObject(value);
  return {
    id: stringField(record, "id"),
    title: stringField(record, "title"),
    createdAt: stringField(record, "createdAt"),
    updatedAt: stringField(record, "updatedAt"),
  };
}

export function parseScript(value: unknown): SavedScript {
  const record = asObject(value);
  return {
    ...parseSummary(record),
    source: stringField(record, "source"),
    scenario: scenarioField(record),
  };
}

function parseResultSummary(value: unknown): SavedResultSummary {
  const record = asObject(value);
  return {
    id: stringField(record, "id"),
    analysisId: stringField(record, "analysisId"),
    createdAt: stringField(record, "createdAt"),
  };
}

export function parseResult(value: unknown): SavedResult {
  const record = asObject(value);
  if (!("document" in record)) throw new UnexpectedResponse();
  return { ...parseResultSummary(record), scriptId: stringField(record, "scriptId"), document: record["document"] };
}

export function listScripts(page: number, pageSize = SCRIPTS_PAGE_SIZE): Promise<Page<ScriptSummary>> {
  return apiRequest(`/api/scripts?${pageQuery(page, pageSize)}`, { auth: "required" }).then((response) =>
    parsePage(response, parseSummary),
  );
}

export async function getScript(id: string): Promise<SavedScript> {
  return parseScript(unwrap(await apiRequest(`/api/scripts/${encodeURIComponent(id)}`, { auth: "required" })));
}

export async function createScript(draft: ScriptDraft): Promise<SavedScript> {
  return parseScript(unwrap(await apiRequest("/api/scripts", { method: "POST", body: draft, auth: "required" })));
}

export async function updateScript(id: string, patch: Partial<ScriptDraft>): Promise<SavedScript> {
  return parseScript(
    unwrap(
      await apiRequest(`/api/scripts/${encodeURIComponent(id)}`, { method: "PUT", body: patch, auth: "required" }),
    ),
  );
}

export async function deleteScript(id: string): Promise<void> {
  await apiRequest(`/api/scripts/${encodeURIComponent(id)}`, { method: "DELETE", auth: "required" });
}

export function listResults(scriptId: string, page: number, pageSize = SCRIPTS_PAGE_SIZE): Promise<Page<SavedResultSummary>> {
  return apiRequest(`/api/scripts/${encodeURIComponent(scriptId)}/results?${pageQuery(page, pageSize)}`, {
    auth: "required",
  }).then((response) => parsePage(response, parseResultSummary));
}

export async function getResult(scriptId: string, id: string): Promise<SavedResult> {
  const path = `/api/scripts/${encodeURIComponent(scriptId)}/results/${encodeURIComponent(id)}`;
  return parseResult(unwrap(await apiRequest(path, { auth: "required" })));
}

/** Copies a finished analysis into the script. The server reads the document itself. */
export async function saveResult(scriptId: string, analysisId: string): Promise<SavedResultSummary> {
  const path = `/api/scripts/${encodeURIComponent(scriptId)}/results`;
  return parseResultSummary(unwrap(await apiRequest(path, { method: "POST", body: { analysisId }, auth: "required" })));
}

export async function deleteResult(scriptId: string, id: string): Promise<void> {
  const path = `/api/scripts/${encodeURIComponent(scriptId)}/results/${encodeURIComponent(id)}`;
  await apiRequest(path, { method: "DELETE", auth: "required" });
}
