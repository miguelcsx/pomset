/**
 * JSON Canonicalization Scheme, RFC 8785.
 *
 * A snapshot manifest is identified by the hash of its canonical serialization,
 * so two deployments that hold the same bytes must compute the same hash. The
 * RFC fixes every degree of freedom a JSON serializer normally has: object keys
 * are sorted by UTF-16 code unit, strings are escaped minimally, and numbers use
 * ECMAScript's shortest round-trip form — which is, by construction, exactly what
 * `Number.prototype.toString` produces in this language. The Python side uses a
 * library to reach the same form, and a shared fixture proves the two agree.
 *
 * Values outside the interoperable JSON range are rejected rather than encoded:
 * the contract carries an integer outside the safe range as a decimal string
 * under an explicit schema, so an unrepresentable one must not reach here. Note
 * that this is a rule about the *contracts*, not about the canonical form: a
 * double such as `1e30` is serialized exactly, because ECMAScript's
 * number-to-string round-trips it, and RFC 8785 relies on that.
 */

function reject(value: unknown, reason: string): never {
  throw new TypeError(`not I-JSON: ${reason}`);
}

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) reject(value, "number is not finite");
  // ECMAScript's number-to-string is the RFC's rule, and it round-trips every
  // finite double exactly. `-0` serializes as `0`.
  return Object.is(value, -0) ? "0" : String(value);
}

function canonicalString(value: string): string {
  let out = '"';
  for (const character of value) {
    const code = character.codePointAt(0) as number;
    switch (character) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default:
        if (code < 0x20) {
          out += `\\u${code.toString(16).padStart(4, "0")}`;
        } else {
          out += character;
        }
    }
  }
  return `${out}"`;
}

function canonicalizeValue(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return canonicalNumber(value);
    case "string":
      return canonicalString(value);
    case "object":
      break;
    default:
      return reject(value, `unsupported value of type ${typeof value}`);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeValue(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  // RFC 8785 sorts member names by their UTF-16 code units, which is the
  // default comparison of JavaScript strings.
  const keys = Object.keys(record).sort();
  const members = keys.map(
    (key) => `${canonicalString(key)}:${canonicalizeValue(record[key])}`,
  );
  return `{${members.join(",")}}`;
}

/** The RFC 8785 canonical serialization of a value, as a UTF-8 string. */
export function canonicalize(value: unknown): string {
  return canonicalizeValue(value);
}

/** The canonical serialization's UTF-8 bytes. */
export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
