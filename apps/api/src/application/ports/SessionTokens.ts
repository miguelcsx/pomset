/**
 * Signed session tokens. A token names an account and nothing else: the role
 * and the account's existence are read from the store on every request, so a
 * demoted or deleted account loses access without waiting for its token to expire.
 */

export interface SessionTokens {
  issue(accountId: string): string;
  /** The account a token names, or `undefined` when it is forged, expired or foreign. */
  verify(token: string): string | undefined;
}
