/**
 * Form checks that mirror the API's rules, so a form can show a problem before
 * the request is sent. The API remains the authority: these only save a round
 * trip, and a server 400 still fills the same field messages.
 *
 * Lengths are counted the way the API counts them (UTF-16 code units, and
 * bytes for the password), so a value passes here exactly when it passes there.
 */

export type FieldErrors = Readonly<Record<string, string>>;

export const EMAIL_MAX_LENGTH = 254;
export const DISPLAY_NAME_MAX_LENGTH = 60;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
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
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES)
    return `Use at most ${PASSWORD_MAX_BYTES} bytes`;
  return undefined;
}

/** Sign-in checks the email shape and that a password was typed; strength is checked at registration. */
export function loginErrors(input: { readonly email: string; readonly password: string }): FieldErrors {
  const email = normalizeEmail(input.email);
  const errors: Record<string, string> = {};
  const emailProblem = emailError(email);
  if (emailProblem) errors["email"] = emailProblem;
  if (input.password.length === 0) errors["password"] = "Enter your password";
  return errors;
}

export function registrationErrors(input: {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}): FieldErrors {
  const errors: Record<string, string> = {};
  const emailProblem = emailError(normalizeEmail(input.email));
  const passwordProblem = passwordError(input.password);
  const nameProblem = displayNameError(input.displayName.trim());
  if (emailProblem) errors["email"] = emailProblem;
  if (passwordProblem) errors["password"] = passwordProblem;
  if (nameProblem) errors["displayName"] = nameProblem;
  return errors;
}
