/**
 * Creates a `user` account and signs it in. Registration never grants a role:
 * an administrator exists only where an operator seeds one.
 */

import { randomUUID } from "node:crypto";

import { conflict } from "../../domain/errors/ApplicationError.js";
import { parseRegistration } from "../../domain/accounts/Registration.js";
import type { PasswordHasher } from "../ports/PasswordHasher.js";
import type { SessionTokens } from "../ports/SessionTokens.js";
import type { UserRepository } from "../ports/UserRepository.js";
import type { Session } from "./Session.js";

export interface RegisterDependencies {
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: SessionTokens;
  readonly now: () => Date;
}

export class RegisterAccount {
  constructor(private readonly deps: RegisterDependencies) {}

  async execute(input: unknown): Promise<Session> {
    const registration = parseRegistration(input);
    const passwordHash = await this.deps.hasher.hash(registration.password);
    const account = await this.deps.users.create({
      id: randomUUID(),
      email: registration.email,
      displayName: registration.displayName,
      passwordHash,
      role: "user",
      createdAt: this.deps.now().toISOString(),
    });
    if (!account)
      throw conflict("An account already uses this email address", {
        fields: { email: "This email address already has an account" },
      });
    return { token: this.deps.tokens.issue(account.id), user: account };
  }
}
