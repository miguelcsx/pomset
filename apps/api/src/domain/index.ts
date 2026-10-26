/**
 * The domain layer of the local workbench.
 *
 * What a project, a snapshot, a scenario and a result may claim is implemented
 * once in `@pomset/domain` and reused verbatim by the API, the CLI and the
 * worker, so a rule cannot drift between offline and hosted operation. This
 * module is the single import site for that layer from inside `apps/api`, and
 * it adds the error vocabulary the use cases raise.
 *
 * This layer imports no HTTP, persistence, process or solver code.
 */

export * from "@pomset/domain";
export * from "./errors/ApplicationError.js";
