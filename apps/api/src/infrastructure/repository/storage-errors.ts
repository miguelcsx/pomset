/**
 * `@pomset/storage` states a refusal with a `CODE: message` prefix. That is the
 * vocabulary of an external library, so it is translated into this
 * application's error kinds once, here at the adapter. Nothing above this file
 * inspects the text of an error to decide a response.
 */

import { badRequest } from "../../domain/index.js";
const PREFIXES: readonly { prefix: string; raise: (message: string) => Error }[] = [
  { prefix: "INPUT_INVALID: ", raise: badRequest },
  { prefix: "PROTOCOL_INVALID: ", raise: badRequest },
];

export function translate<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const { prefix, raise } of PREFIXES) {
      if (message.startsWith(prefix)) throw raise(message.slice(prefix.length));
    }
    throw error;
  }
}
