/**
 * The account and session the API hands back, as the browser holds them.
 * The role values mirror the API's; anything else is refused at the boundary.
 */

import { asObject, stringField, type JsonObject, UnexpectedResponse } from "../common/json";

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly createdAt: string;
}

export interface Session {
  readonly token: string;
  readonly user: Account;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function parseAccount(value: unknown): Account {
  const record: JsonObject = asObject(value);
  const role = stringField(record, "role");
  if (!isRole(role)) throw new UnexpectedResponse();
  return {
    id: stringField(record, "id"),
    email: stringField(record, "email"),
    displayName: stringField(record, "displayName"),
    role,
    createdAt: stringField(record, "createdAt"),
  };
}

export function parseSession(value: unknown): Session {
  const record = asObject(value);
  return { token: stringField(record, "token"), user: parseAccount(record["user"]) };
}
