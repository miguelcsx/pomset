/**
 * Where accounts are kept. The password hash crosses this boundary only inside
 * `StoredUser`, which sign-in reads and nothing returns to a caller.
 */

import type { Account, Role } from "../../domain/accounts/Account.js";

export interface StoredUser extends Account {
  readonly passwordHash: string;
}

export interface NewUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly role: Role;
  readonly createdAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | undefined>;
  findById(id: string): Promise<Account | undefined>;
  /** Resolves to `undefined` when the email already belongs to an account. */
  create(user: NewUser): Promise<Account | undefined>;
  list(window: { skip: number; take: number }): Promise<{ items: Account[]; total: number }>;
}
