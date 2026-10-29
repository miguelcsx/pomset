"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError, failureMessage } from "../common/http";
import { TextField } from "../ui/TextField";
import { linkButton, noticeBox, primaryButton } from "../ui/classes";
import { register } from "./auth-api";
import { afterSignInHref, authHref, nextFromLocation, readFragment } from "./navigation";
import { useBrowserLocation } from "./use-browser-location";
import { DISPLAY_NAME_MAX_LENGTH, normalizeEmail, registrationErrors, type FieldErrors } from "./validation";

export function RegisterForm() {
  const router = useRouter();
  const here = useBrowserLocation();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = registrationErrors({ email, password, displayName });
    setErrors(problems);
    setFormError(undefined);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await register({ email: normalizeEmail(email), password, displayName: displayName.trim() });
      // Stays busy until the navigation replaces this page.
      router.replace(afterSignInHref(nextFromLocation(), readFragment()));
    } catch (failure) {
      setErrors(failure instanceof ApiError ? failure.fields : {});
      setFormError(failureMessage(failure));
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="mt-6 grid gap-4" aria-labelledby="register-title">
      {formError && (
        <p role="alert" className={noticeBox}>
          {formError}
        </p>
      )}
      <TextField
        id="register-name"
        label="Display name"
        name="displayName"
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        error={errors["displayName"]}
        disabled={busy}
      />
      <TextField
        id="register-email"
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors["email"]}
        disabled={busy}
      />
      <TextField
        id="register-password"
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors["password"]}
        disabled={busy}
      />
      <p className="-mt-2 text-sm text-muted">
        Use at least 8 characters. Passwords are limited to 72 bytes.
      </p>
      <button type="submit" className={primaryButton} disabled={busy} aria-busy={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className={linkButton} href={authHref("/login", here.next ?? "/", here.fragment)}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
