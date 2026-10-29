/**
 * Checks an email and password. Every refusal gives the same message, so a
 * caller cannot tell an unknown email from a wrong password.
 */

import { unauthenticated } from "../../domain/errors/ApplicationError.js";
import { parseCredentials } from "../../domain/accounts/Registration.js";
import type { PasswordHasher } from "../ports/PasswordHasher.js";
import type { SessionTokens } from "../ports/SessionTokens.js";
import type { UserRepository } from "../ports/UserRepository.js";
import type { Session } from "./Session.js";

export interface SignInDependencies {
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: SessionTokens;
}

const REFUSED = "The email address or password is incorrect";

export class SignIn {
  constructor(private readonly deps: SignInDependencies) {}

  async execute(input: unknown): Promise<Session> {
    const credentials = parseCredentials(input);
    const user = await this.deps.users.findByEmail(credentials.email);
    const matches = await this.deps.hasher.verify(credentials.password, user?.passwordHash);
    if (!user || !matches) throw unauthenticated(REFUSED);

    const { passwordHash: _hash, ...account } = user;
    return { token: this.deps.tokens.issue(account.id), user: account };
  }
}
