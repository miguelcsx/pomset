/**
 * Sign-in, registration and sign-out. Both calls store the session they return;
 * sign-out is local because the API's tokens are self-contained and expire on
 * their own, so there is no server session to end.
 */

import { apiRequest, unwrap } from "../common/http";
import { parseSession, type Session } from "./account";
import { clearSession, saveSession } from "./session-store";

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface RegistrationInput extends LoginInput {
  readonly displayName: string;
}

export async function signIn(input: LoginInput): Promise<Session> {
  const session = parseSession(
    unwrap(await apiRequest("/api/auth/login", { method: "POST", body: input })),
  );
  saveSession(session);
  return session;
}

export async function register(input: RegistrationInput): Promise<Session> {
  const session = parseSession(
    unwrap(await apiRequest("/api/auth/register", { method: "POST", body: input })),
  );
  saveSession(session);
  return session;
}

export function signOut(): void {
  clearSession();
}
