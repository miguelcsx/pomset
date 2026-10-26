/**
 * `@pomset/contracts` is the one authority for every portable record.
 *
 * The canonical JSON Schemas live in `schema/`; the bindings in `./generated`
 * are produced from them by `scripts/generate.ts`, so a hand-written duplicate
 * type cannot appear. Two registries are hand-written because they are policy
 * rather than shape: `./errors` (the single error vocabulary) and `./tuples`
 * (the closed outcome x method x evidenceClass table). `./validate` is the
 * runtime gate; the generated types are the compile-time shape.
 */

export * from "./errors.js";
export * from "./generated/index.js";
export * from "./tuples.js";
export * from "./validate.js";

export * from "./evidence-links.js";

export * from "./semantic.js";

export { canonicalize, canonicalBytes } from "./canonicalize.js";
