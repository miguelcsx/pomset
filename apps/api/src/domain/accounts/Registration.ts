/**
 * Turns an untrusted request body into the values an account is created from.
 *
 * Every refused field is reported together, so a form can show all of its
 * problems at once. Only the fields the caller may set are read: a role or an
 * identifier sent in the body is ignored, never copied into the account.
 */

import { badRequest } from "../errors/ApplicationError.js";
import {
  displayNameError,
  emailError,
  type FieldErrors,
  normalizeEmail,
  passwordError,
} from "./Account.js";

export interface Registration {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export function parseRegistration(input: unknown): Registration {
  const body = asObject(input);
  const email = normalizeEmail(text(body, "email"));
  const password = text(body, "password");
  const displayName = text(body, "displayName").trim();

  const fields: Record<string, string> = {};
  record(fields, "email", emailError(email));
  record(fields, "password", passwordError(password));
  record(fields, "displayName", displayNameError(displayName));
  refuseIfAny(fields);

  return { email, password, displayName };
}

/**
 * A sign-in only checks that both fields are present. The strength rules are
 * enforced when an account is created, and a sign-in must not reveal which
 * rule an unknown account would have failed.
 */
export function parseCredentials(input: unknown): Credentials {
  const body = asObject(input);
  const fields: Record<string, string> = {};
  const email = normalizeEmail(text(body, "email"));
  const password = text(body, "password");
  if (email.length === 0) fields["email"] = "Enter your email address";
  if (password.length === 0) fields["password"] = "Enter your password";
  refuseIfAny(fields);
  return { email, password };
}

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw badRequest("Send a JSON object");
  return input as Record<string, unknown>;
}

function text(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  return typeof value === "string" ? value : "";
}

function record(fields: Record<string, string>, name: string, message?: string): void {
  if (message) fields[name] = message;
}

function refuseIfAny(fields: FieldErrors): void {
  if (Object.keys(fields).length > 0)
    throw badRequest("Some fields need correcting", { fields });
}
