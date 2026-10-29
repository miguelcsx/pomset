"use client";

/**
 * A password input with a control that shows or hides the typed text. The
 * control is a toggle button, so its state is announced with `aria-pressed`.
 */

import { useState } from "react";

import { Icon } from "@pomset/ui";

import { revealButton } from "./classes";
import { TextField, type TextFieldProps } from "./TextField";

export function PasswordField(props: Omit<TextFieldProps, "type" | "action">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      action={
        <button
          type="button"
          className={revealButton}
          aria-label="Show password"
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible(!visible)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={18} />
        </button>
      }
    />
  );
}
