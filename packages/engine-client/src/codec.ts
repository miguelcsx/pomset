/**
 * The wire codec.
 *
 * The engine boundary is JSON Lines over the child process's stdin and stdout:
 * one JSON object per line, no framing beyond the newline. stderr carries
 * bounded diagnostics and is never parsed as a second protocol channel, which is
 * what keeps one channel, one parser and one set of validation rules.
 */

import type { Readable, Writable } from "node:stream";

/** A message larger than this is refused rather than buffered. */
export const DEFAULT_MAX_MESSAGE_BYTES = 1_048_576;

export class MessageTooLargeError extends Error {
  constructor(readonly bytes: number, readonly limit: number) {
    super(`engine message of ${bytes} bytes exceeds the ${limit} byte limit`);
    this.name = "MessageTooLargeError";
  }
}
export class InvalidEncodingError extends Error {
  constructor() { super("engine stream is not valid UTF-8"); this.name = "InvalidEncodingError"; }
}
function utf8(bytes: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new InvalidEncodingError(); }
}

/** Encodes one message as a single newline-terminated JSON line. */
export function encodeMessage(message: unknown, maxBytes = DEFAULT_MAX_MESSAGE_BYTES): Buffer {
  const line = `${JSON.stringify(message)}\n`;
  const bytes = Buffer.byteLength(line, "utf8");
  if (bytes > maxBytes) throw new MessageTooLargeError(bytes, maxBytes);
  return Buffer.from(line, "utf8");
}

/** Parses one line. A malformed line is an error, never a partial message. */
export function decodeLine(line: string): unknown {
  return JSON.parse(line);
}

/**
 * Reads newline-delimited lines from a stream, yielding each complete line
 * without its terminator. A final line without a newline is yielded as well, so
 * a truncated stream loses nothing silently.
 */
export async function* readLines(
  stream: Readable,
  maxBytes = DEFAULT_MAX_MESSAGE_BYTES,
  onBytes?: (bytes: number) => void,
): AsyncGenerator<string> {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stream) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk as Buffer;
    onBytes?.(bytes.byteLength);
    buffer = Buffer.concat([buffer, bytes]);
    let index = buffer.indexOf(10);
    while (index !== -1) {
      const bytes = buffer.subarray(0, index);
      buffer = buffer.subarray(index + 1);
      if (bytes.length + 1 > maxBytes) {
        throw new MessageTooLargeError(bytes.length + 1, maxBytes);
      }
      const line = utf8(bytes);
      if (line.trim().length > 0) yield line;
      index = buffer.indexOf(10);
    }
    if (buffer.length > maxBytes) throw new MessageTooLargeError(buffer.length, maxBytes);
  }
  if (buffer.length > 0) yield utf8(buffer);
}

/**
 * The bounded stderr reader. Diagnostics only: it yields text and is never fed
 * to the envelope validator.
 */
export async function* readDiagnostics(stream: Readable, maxBytes: number, onBytes?: (bytes: number) => void): AsyncGenerator<string> {
  let seen = 0;
  const decoder = new TextDecoder("utf-8");
  for await (const chunk of stream) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk as Buffer;
    seen += bytes.byteLength;
    onBytes?.(bytes.byteLength);
    if (seen > maxBytes) throw new MessageTooLargeError(seen, maxBytes);
    yield decoder.decode(bytes, { stream: true });
  }
  yield decoder.decode();
}

/** Writes one encoded message and waits for it to be flushed. */
export async function writeMessage(
  stream: Writable,
  message: unknown,
  maxBytes = DEFAULT_MAX_MESSAGE_BYTES,
): Promise<void> {
  const encoded = encodeMessage(message, maxBytes);
  await new Promise<void>((resolve, reject) => {
    stream.write(encoded, (error) => (error ? reject(error) : resolve()));
  });
}
