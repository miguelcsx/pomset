/** Which account submitted each analysis. Reads and cancellation check it first. */

export interface AnalysisOwners {
  record(analysisId: string, userId: string, now: string): Promise<void>;
  ownerOf(analysisId: string): Promise<string | undefined>;
  /** The analyses one account submitted, newest first. */
  analysisIdsOf(userId: string, limit: number): Promise<string[]>;
}
