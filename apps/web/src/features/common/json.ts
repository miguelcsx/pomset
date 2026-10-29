/**
 * Narrowing helpers for JSON the server sends. Every response is untrusted
 * until these have checked it, so no field reaches the UI typed by assertion.
 */

export type JsonObject = Readonly<Record<string, unknown>>;

export class UnexpectedResponse extends Error {
  constructor() {
    super("The server sent a response this page does not understand.");
    this.name = "UnexpectedResponse";
  }
}

export function asObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new UnexpectedResponse();
  return value as JsonObject;
}

export function stringField(record: JsonObject, name: string): string {
  const value = record[name];
  if (typeof value !== "string") throw new UnexpectedResponse();
  return value;
}

export function nullableStringField(record: JsonObject, name: string): string | null {
  const value = record[name];
  if (value === null) return null;
  if (typeof value !== "string") throw new UnexpectedResponse();
  return value;
}

export function numberField(record: JsonObject, name: string): number {
  const value = record[name];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new UnexpectedResponse();
  return value;
}

export function arrayField(record: JsonObject, name: string): readonly unknown[] {
  const value = record[name];
  if (!Array.isArray(value)) throw new UnexpectedResponse();
  return value;
}

/** Field name to message, as the API returns them beside a 400. */
export function fieldErrors(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}
