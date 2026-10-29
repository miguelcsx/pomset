/**
 * Turns a bearer token into the account that is signed in now. The account is
 * read from the store every time, so its current role is the one that counts.
 */

import { unauthenticated } from "../../domain/errors/ApplicationError.js";
import type { Account } from "../../domain/accounts/Account.js";
import type { SessionTokens } from "../ports/SessionTokens.js";
import type { UserRepository } from "../ports/UserRepository.js";

export interface ResolveSessionDependencies {
  readonly users: UserRepository;
  readonly tokens: SessionTokens;
}

export class ResolveSession {
  constructor(private readonly deps: ResolveSessionDependencies) {}

  async execute(token: string): Promise<Account> {
    const accountId = this.deps.tokens.verify(token);
    const account = accountId === undefined ? undefined : await this.deps.users.findById(accountId);
    if (!account) throw unauthenticated("Sign in to continue");
    return account;
  }
}
