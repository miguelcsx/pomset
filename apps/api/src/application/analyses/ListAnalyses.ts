/**
 * The recent history this workbench holds, newest first.
 *
 * A run being over proves nothing about the kernel, so the history is a list of
 * attempts and their states, not a list of verdicts.
 */

import type { Job } from "@pomset/contracts";

import type { AnalysisRepository } from "../ports/AnalysisRepository.js";

export class ListAnalyses {
  constructor(private readonly repository: AnalysisRepository) {}

  execute(): Job[] {
    return this.repository.history();
  }
}
