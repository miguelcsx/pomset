/**
 * Where scripts are kept. Every method takes the owner, so a script that belongs
 * to someone else is indistinguishable from one that does not exist.
 */

import type { SavedScript, ScriptInput, ScriptPatch, ScriptSummary } from "../../domain/scripts/SavedScript.js";

export interface ScriptRepository {
  list(userId: string, window: { skip: number; take: number }): Promise<{ items: ScriptSummary[]; total: number }>;
  find(userId: string, id: string): Promise<SavedScript | undefined>;
  create(userId: string, input: ScriptInput, now: string): Promise<SavedScript>;
  update(userId: string, id: string, patch: ScriptPatch, now: string): Promise<SavedScript | undefined>;
  remove(userId: string, id: string): Promise<boolean>;
}
