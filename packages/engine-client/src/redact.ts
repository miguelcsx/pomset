/**
 * Secret redaction.
 *
 * A report is meant to be shareable; a log that carries a token is not. Every
 * captured diagnostic, compiler log and error detail passes through this filter
 * **on the way in**, so no unredacted copy is ever written to storage or to an
 * artifact, and a reader can tell that something was removed without learning
 * what it was.
 *
 * The pattern set is data with a recorded revision, so a report states which
 * revision produced it. A value that already carries a marker is not marked a
 * second time.
 */

/** The revision of the pattern set, recorded alongside any redacted output. */
export const REDACTION_REVISION = "2";

interface Pattern {
  readonly label: string;
  readonly pattern: RegExp;
}

const MARKER = (label: string): string => `[redacted:${label}]`;

const PATTERNS: readonly Pattern[] = [
  { label: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi },
  { label: "authorization-header", pattern: /\bAuthorization:\s*\S+/gi },
  { label: "connection-string", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@\S+/gi },
  { label: "session-cookie", pattern: /\b(pomset_session|session|sid)=[A-Za-z0-9._-]{8,}/gi },
  {
    label: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  },
  { label: "api-key", pattern: /\b(?:api[_-]?key|token|secret)\s*[:=]\s*[A-Za-z0-9._-]{8,}/gi },
];

/** The labels the pattern set recognises, for a report to cite. */
export function redactionLabels(): readonly string[] {
  return PATTERNS.map((entry) => entry.label);
}

/**
 * Replaces every recognised secret with a labelled marker. Applying it twice is
 * safe: a marker contains no match for any pattern, so it survives unchanged.
 */
export function redact(text: string): string {
  let result = text;
  for (const { label, pattern } of PATTERNS) {
    result = result.replace(pattern, (match) => {
      // A value already carrying a marker is left alone.
      if (match.includes("[redacted:")) return match;
      return MARKER(label);
    });
  }
  return result;
}

/** Redacts each captured diagnostic line, keeping the stream's shape. */
export function redactLines(lines: Iterable<string>): string[] {
  return [...lines].map((line) => redact(line));
}
