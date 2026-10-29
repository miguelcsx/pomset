/** What a successful registration or sign-in hands back to the browser. */

import type { Account } from "../../domain/accounts/Account.js";

export interface Session {
  readonly token: string;
  readonly user: Account;
}
