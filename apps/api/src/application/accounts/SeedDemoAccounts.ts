/**
 * Creates the two accounts the README documents, so a reviewer can sign in as
 * an administrator and as an ordinary user without registering.
 *
 * It runs only when an operator asks for it, and it creates an account only
 * when its email is free: a restart never changes an existing account's role or
 * password. The passwords come from the operator, never from this file.
 */

import { randomUUID } from "node:crypto";

import { passwordError } from "../../domain/accounts/Account.js";
import type { PasswordHasher } from "../ports/PasswordHasher.js";
import type { UserRepository } from "../ports/UserRepository.js";

export const DEMO_ADMIN = { email: "admin@pomset.example", displayName: "Demo administrator", role: "admin" } as const;
export const DEMO_USER = { email: "user@pomset.example", displayName: "Demo user", role: "user" } as const;

export interface DemoPasswords {
  readonly admin: string;
  readonly user: string;
}

export async function seedDemoAccounts(
  deps: { users: UserRepository; hasher: PasswordHasher; now: () => Date },
  passwords: DemoPasswords,
): Promise<void> {
  for (const [account, password] of [
    [DEMO_ADMIN, passwords.admin],
    [DEMO_USER, passwords.user],
  ] as const) {
    const problem = passwordError(password);
    if (problem) throw new Error(`Demo password for ${account.email}: ${problem}`);
    if (await deps.users.findByEmail(account.email)) continue;
    await deps.users.create({
      id: randomUUID(),
      email: account.email,
      displayName: account.displayName,
      passwordHash: await deps.hasher.hash(password),
      role: account.role,
      createdAt: deps.now().toISOString(),
    });
  }
}
