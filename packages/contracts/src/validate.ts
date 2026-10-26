/** Node adapter over the portable, shared runtime validator. */
import { readFileSync, readdirSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSchemaSet, type SchemaDocuments, type SchemaSet } from "./schema-set.js";
export { createSchemaSet, type SchemaDocuments, type SchemaSet } from "./schema-set.js";

export const SCHEMA_DIR = fileURLToPath(new URL("../schema", import.meta.url));
export function loadSchemas(dir: string): SchemaDocuments {
  const documents = new Map<string, Record<string, unknown>>();
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".schema.yaml")) continue;
    const schema = parseYaml(readFileSync(join(dir, entry), "utf8")) as Record<string, unknown>;
    const id = schema["$id"];
    if (typeof id !== "string") throw new Error(`${entry} has no $id`);
    documents.set(id, schema);
  }
  return documents;
}
let cached: SchemaSet | undefined;
export function schemaSet(): SchemaSet {
  cached ??= createSchemaSet(loadSchemas(SCHEMA_DIR));
  return cached;
}
