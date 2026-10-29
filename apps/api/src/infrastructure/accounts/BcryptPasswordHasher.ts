/**
 * bcrypt with a fixed cost. A missing hash is compared against a decoy computed
 * once, so the work done for an unknown email matches the work done for a known one.
 */

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import type { PasswordHasher } from "../../application/ports/PasswordHasher.js";

const COST = 12;

export class BcryptPasswordHasher implements PasswordHasher {
  private decoy: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, COST);
  }

  async verify(password: string, hash: string | undefined): Promise<boolean> {
    const matches = await bcrypt.compare(password, hash ?? (await this.placeholder()));
    return hash !== undefined && matches;
  }

  private placeholder(): Promise<string> {
    this.decoy ??= bcrypt.hash(randomBytes(32).toString("hex"), COST);
    return this.decoy;
  }
}
