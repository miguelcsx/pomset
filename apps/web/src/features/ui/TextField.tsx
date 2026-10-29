"use client";

/**
 * A labelled input wired to its error message. The message is announced and
 * linked with `aria-describedby`, and the input is marked `aria-invalid`.
 * `action` sits at the input's trailing edge, for a control such as a
 * show/hide toggle.
 */

import type { ComponentProps, ReactNode } from "react";

import { errorText, field } from "./classes";

export type TextFieldProps = ComponentProps<"input"> & {
  readonly id: string;
  readonly label: string;
  readonly error?: string | undefined;
  readonly action?: ReactNode;
};

export function TextField({ id, label, error, action, ...input }: TextFieldProps) {
  const errorId = `${id}-error`;
  const control = (
    <input
      {...input}
      id={id}
      className={action ? `${field} pr-10` : field}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    />
  );
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {action ? (
        <div className="relative">
          {control}
          <div className="absolute inset-y-0 right-1 flex items-center">{action}</div>
        </div>
      ) : (
        control
      )}
      {error && (
        <p id={errorId} className={`${errorText} mt-1`}>
          {error}
        </p>
      )}
    </div>
  );
}
