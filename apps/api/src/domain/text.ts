/**
 * Text rules shared by every field a person types: names, titles, and anything
 * else that is shown back to someone else.
 */

/** Control characters, including line breaks, have no place in a name or a title. */
export function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
