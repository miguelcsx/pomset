/**
 * Turns passwords into one-way hashes and checks them.
 *
 * `verify` always does the expensive comparison, even when there is no hash to
 * compare against. Otherwise a sign-in for an unknown email would answer faster
 * than one for a known email, and the timing would reveal which addresses exist.
 */

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string | undefined): Promise<boolean>;
}
