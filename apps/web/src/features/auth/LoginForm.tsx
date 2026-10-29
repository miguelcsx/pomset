"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError, failureMessage } from "../common/http";
import { PasswordField } from "../ui/PasswordField";
import { TextField } from "../ui/TextField";
import { linkButton, noticeBox, primaryButton } from "../ui/classes";
import { signIn } from "./auth-api";
import { afterSignInHref, authHref, nextFromLocation, readFragment } from "./navigation";
import { useBrowserLocation } from "./use-browser-location";
import { loginErrors, normalizeEmail, type FieldErrors } from "./validation";

export function LoginForm() {
  const router = useRouter();
  const here = useBrowserLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = loginErrors({ email, password });
    setErrors(problems);
    setFormError(undefined);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await signIn({ email: normalizeEmail(email), password });
      // Stays busy until the navigation replaces this page.
      router.replace(afterSignInHref(nextFromLocation(), readFragment()));
    } catch (failure) {
      setErrors(failure instanceof ApiError ? failure.fields : {});
      setFormError(failureMessage(failure));
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="mt-6 grid gap-4" aria-labelledby="login-title">
      {formError && (
        <p role="alert" className={noticeBox}>
          {formError}
        </p>
      )}
      <TextField
        id="login-email"
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
      <PasswordField
        id="login-password"
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors["password"]}
        disabled={busy}
      />
      <button type="submit" className={primaryButton} disabled={busy} aria-busy={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-muted">
        No account yet?{" "}
        <Link className={linkButton} href={authHref("/register", here.next ?? "/", here.fragment)}>
          Create an account
        </Link>
      </p>
    </form>
  );
}
