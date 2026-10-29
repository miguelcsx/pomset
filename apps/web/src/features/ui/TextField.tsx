"use client";

/**
 * A labelled input wired to its error message. The message is announced and
 * linked with `aria-describedby`, and the input is marked `aria-invalid`.
 */

import type { ComponentProps } from "react";

import { errorText, field } from "./classes";

export type TextFieldProps = ComponentProps<"input"> & {
  readonly id: string;
  readonly label: string;
  readonly error?: string | undefined;
};

export function TextField({ id, label, error, ...input }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        {...input}
        id={id}
        className={field}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className={`${errorText} mt-1`}>
          {error}
        </p>
      )}
    </div>
  );
}
