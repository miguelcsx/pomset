/**
 * Finished analyses a user chose to keep against a script. The stored document
 * is a copy, so it stays what it was when it was saved.
 */

export interface SavedResultSummary {
  readonly id: string;
  readonly analysisId: string;
  readonly createdAt: string;
}

export interface SavedResultRecord extends SavedResultSummary {
  readonly scriptId: string;
  readonly document: unknown;
}

export interface ResultRepository {
  list(
    userId: string,
    scriptId: string,
    window: { skip: number; take: number },
  ): Promise<{ items: SavedResultSummary[]; total: number }>;
  find(userId: string, scriptId: string, id: string): Promise<SavedResultRecord | undefined>;
  /**
   * `document` is the finished analysis already encoded as JSON text, so the
   * size the use case checked is the size that is stored. Resolves to
   * `undefined` when this analysis is already saved against the script.
   */
  create(
    userId: string,
    scriptId: string,
    analysisId: string,
    document: string,
    now: string,
  ): Promise<SavedResultRecord | undefined>;
  remove(userId: string, scriptId: string, id: string): Promise<boolean>;
}
