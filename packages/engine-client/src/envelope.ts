/**
 * Envelope validation and per-direction sequencing.
 *
 * Every engine message carries `protocolVersion`, `jobId`, `attemptId`,
 * `sequence` and `type`. Each direction keeps its own increasing sequence
 * starting at 1, so a duplicated or skipped number is a protocol fault rather
 * than a silently reordered stream. Exactly one `hello` opens the exchange; a
 * first message that is not a hello, a mismatched version or a repeated hello is
 * a protocol failure and fails the job.
 */

import { schemaSet } from "@pomset/contracts";

import { errorRecord, type ErrorRecord } from "./errors.js";

import { PROTOCOL_VERSION } from "./index.js";

/** The message types an engine may send. */
export const ENGINE_MESSAGE_TYPES = [
  "hello",
  "progress",
  "finding",
  "artifact",
  "result",
  "error",
] as const;

export type EngineMessageType = (typeof ENGINE_MESSAGE_TYPES)[number];

export interface EngineEnvelope {
  readonly protocolVersion: number;
  readonly jobId: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly type: EngineMessageType | "cancel";
  readonly payload: Record<string, unknown>;
}

export class ProtocolError extends Error {
  readonly record: ErrorRecord;
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "ProtocolError";
    this.record = errorRecord("PROTOCOL_INVALID", message, details);
  }
}

/** Validates one inbound message against the envelope schema and the version. */
export function validateEnvelope(raw: unknown, expected: { jobId: string; attemptId: string }): EngineEnvelope {
  const validate = schemaSet().validatorFor("engine.schema.yaml#/$defs/engineEnvelope");
  if (!validate(raw)) {
    const first = validate.errors?.[0];
    throw new ProtocolError(
      `engine envelope is invalid: ${first?.instancePath ?? ""} ${first?.message ?? "malformed"}`,
    );
  }
  const envelope = raw as EngineEnvelope;
  if (envelope.protocolVersion !== PROTOCOL_VERSION) {
    throw new ProtocolError(
      `engine protocol version ${envelope.protocolVersion} is not ${PROTOCOL_VERSION}`,
      { protocolVersion: envelope.protocolVersion },
    );
  }
  if (envelope.jobId !== expected.jobId || envelope.attemptId !== expected.attemptId) {
    throw new ProtocolError("engine message names a different job or attempt", {
      jobId: envelope.jobId,
      attemptId: envelope.attemptId,
    });
  }
  const targets: Record<string, string> = {
    hello: "engine.schema.yaml#/$defs/helloPayload", progress: "engine.schema.yaml#/$defs/progressPayload",
    finding: "evidence.schema.yaml#/$defs/finding", artifact: "evidence.schema.yaml#/$defs/artifactManifest",
    result: "evidence.schema.yaml#/$defs/analysisResult", error: "engine.schema.yaml#/$defs/errorRecord",
  };
  const target = targets[envelope.type];
  if (!target) throw new ProtocolError("supervisor received a message in the wrong direction");
  const payload = schemaSet().validatorFor(target);
  if (!payload(envelope.payload)) throw new ProtocolError(`invalid ${envelope.type} payload: ${payload.errors?.[0]?.instancePath} ${payload.errors?.[0]?.message}`);
  if (envelope.type === "result" && (envelope.payload["jobId"] !== expected.jobId || envelope.payload["attemptId"] !== expected.attemptId)) throw new ProtocolError("result payload names a different job or attempt");
  return envelope;
}

/** Validates a supervisor-to-engine cancel message. */
export function validateCancel(raw: unknown): EngineEnvelope {
  const validate = schemaSet().validatorFor("engine.schema.yaml#/$defs/cancelEnvelope");
  if (!validate(raw)) {
    throw new ProtocolError("cancel message is invalid");
  }
  return raw as EngineEnvelope;
}

/**
 * Tracks one direction's sequence. The supervisor's outbound cancel sequence is
 * tracked separately from the engine's inbound one, because the two directions
 * number independently.
 */
export class SequenceTracker {
  #expected = 1;

  get next(): number {
    return this.#expected;
  }

  /** Accepts the next number, or refuses a duplicate or a gap. */
  accept(sequence: number): void {
    if (sequence !== this.#expected) {
      throw new ProtocolError(
        `engine sequence ${sequence} does not follow ${this.#expected - 1}`,
        { expected: this.#expected, received: sequence },
      );
    }
    this.#expected += 1;
  }
}

/**
 * The handshake state: exactly one hello, first. A later hello, or any message
 * before it, is refused.
 */
export class HelloGate {
  #seen = false;

  get opened(): boolean {
    return this.#seen;
  }

  accept(type: string): void {
    if (!this.#seen) {
      if (type !== "hello") {
        throw new ProtocolError(`the first engine message is ${type}, not hello`);
      }
      this.#seen = true;
      return;
    }
    if (type === "hello") {
      throw new ProtocolError("the engine sent a second hello");
    }
  }
}
