import { describe, expect, it } from "vitest";

import {
  displayNameError,
  emailError,
  loginErrors,
  passwordError,
  registrationErrors,
} from "./validation";

describe("registration rules", () => {
  it("accepts a valid registration with no field errors", () => {
    expect(
      registrationErrors({
        email: "  Ada@Example.org ",
        password: "correct horse",
        displayName: " Ada ",
      }),
    ).toEqual({});
  });

  it("reports every field at once", () => {
    expect(registrationErrors({ email: "nope", password: "short", displayName: "" })).toEqual({
      email: "Enter a valid email address",
      password: "Use at least 8 characters",
      displayName: "Enter a display name",
    });
  });

  it("limits the password by UTF-8 bytes, as the API does", () => {
    expect(passwordError("a".repeat(72))).toBeUndefined();
    expect(passwordError("a".repeat(73))).toBe("Use at most 72 bytes");
    // Each of these is one character but four bytes, so 19 of them exceed 72.
    expect(passwordError("😀".repeat(19))).toBe("Use at most 72 bytes");
  });

  it("refuses control characters and long display names", () => {
    expect(displayNameError("Ada\nLovelace")).toBe("Remove the control characters");
    expect(displayNameError("x".repeat(61))).toBe("Use at most 60 characters");
    expect(displayNameError("x".repeat(60))).toBeUndefined();
  });

  it("limits the email length", () => {
    expect(emailError(`${"a".repeat(250)}@b.co`)).toBe("Use at most 254 characters");
  });
});

describe("sign-in rules", () => {
  it("checks the email shape and that a password was typed, not its strength", () => {
    expect(loginErrors({ email: "ada@example.org", password: "x" })).toEqual({});
    expect(loginErrors({ email: "ada", password: "" })).toEqual({
      email: "Enter a valid email address",
      password: "Enter your password",
    });
  });
});
