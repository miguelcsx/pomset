/**
 * The profile this workbench has actually measured.
 *
 * The probe records the interpreter, engine and solver identity it found. It
 * does not validate capabilities: a capability stays untested until a
 * conformance corpus has run against that exact revision, and the workbench
 * must not imply otherwise.
 */

import type { ProfileRevision } from "@pomset/contracts";

import { unavailable } from "../../domain/index.js";
import type { EngineRunner } from "../ports/EngineRunner.js";

export class GetProfile {
  constructor(private readonly engine: EngineRunner) {}

  execute(): ProfileRevision {
    try {
      return this.engine.probe();
    } catch (error) {
      throw unavailable(error instanceof Error ? error.message : String(error));
    }
  }
}
