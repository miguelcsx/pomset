/** Browser-safe bindings and validation, without filesystem or YAML imports. */
import { createSchemaSet, type SchemaSet } from "./schema-set.js";
import { DOCUMENTS } from "./generated/schemas.js";
export * from "./generated/index.js";
export * from "./tuples.js";
let cached: SchemaSet | undefined;
export function schemaSet(): SchemaSet {
  cached ??= createSchemaSet(new Map(Object.entries(DOCUMENTS)));
  return cached;
}

export * from "./evidence-links.js";

export * from "./launch.js";

export * from "./semantic.js";

export { canonicalize, canonicalBytes } from "./canonicalize.js";
