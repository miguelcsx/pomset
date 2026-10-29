/**
 * What an account is, and which values it may hold.
 *
 * The rules live here so the HTTP layer, the demo seed and any future adapter
 * accept exactly the same inputs. Passwords are limited to 72 bytes because
 * bcrypt silently ignores everything after that: accepting a longer one would
 * let two different passwords sign in as the same account.
 */

import { hasControlCharacter } from "../text.js";

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly createdAt: string;
}

export const EMAIL_MAX_LENGTH = 254;
export const DISPLAY_NAME_MAX_LENGTH = 60;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** Field name to the reason it was refused. */
export type FieldErrors = Readonly<Record<string, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function emailError(value: string): string | undefined {
  if (value.length === 0) return "Enter your email address";
  if (value.length > EMAIL_MAX_LENGTH) return `Use at most ${EMAIL_MAX_LENGTH} characters`;
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address";
  return undefined;
}

export function displayNameError(value: string): string | undefined {
  if (value.length === 0) return "Enter a display name";
  if (value.length > DISPLAY_NAME_MAX_LENGTH)
    return `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters`;
  if (hasControlCharacter(value)) return "Remove the control characters";
  return undefined;
}

export function passwordError(value: string): string | undefined {
  if (value.length < PASSWORD_MIN_LENGTH)
    return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES)
    return `Use at most ${PASSWORD_MAX_BYTES} bytes`;
  return undefined;
}
