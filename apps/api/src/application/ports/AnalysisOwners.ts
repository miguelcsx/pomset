/** Which account submitted each analysis. Reads and cancellation check it first. */

export interface AnalysisOwners {
  record(analysisId: string, userId: string, now: string): Promise<void>;
  ownerOf(analysisId: string): Promise<string | undefined>;
  /** One page of the analyses an account submitted, newest first. */
  analysisIdsOf(userId: string, window: { skip: number; take: number }): Promise<string[]>;
  /** How many analyses an account submitted, across all pages. */
  countOf(userId: string): Promise<number>;
}
