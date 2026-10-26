/**
 * The supervisor.
 *
 * It owns the engine process and the record the process produces. Inbound
 * messages are validated against the envelope, sequenced per direction and
 * gated on exactly one opening `hello`; accepted progress, findings and
 * artifacts are appended and never modified or retracted by a later message,
 * which is what makes the durable stream replayable.
 *
 * A violation fails the job, kills the tree and leaves everything already
 * accepted intact. Diagnostics are bounded, redacted on the way in and never
 * parsed as protocol.
 */

import type { ChildProcess } from "node:child_process";

import { readDiagnostics, readLines, decodeLine, MessageTooLargeError, InvalidEncodingError } from "./codec.js";
import { HelloGate, ProtocolError, SequenceTracker, validateEnvelope, type EngineEnvelope } from "./envelope.js";
import { errorRecord, type ErrorRecord } from "./errors.js";
import { watchLimits, type Limits, LimitBreach } from "./limits.js";
import { killProcessTree } from "./process-tree.js";
import { requestCancellation } from "./cancel.js";
import { checkArtifactDirectory } from "./artifacts.js";
import { redact, REDACTION_REVISION } from "./redact.js";

export interface AcceptedChunk {
  readonly type: string;
  readonly sequence: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface SupervisedRun {
  readonly chunks: readonly AcceptedChunk[];
  readonly terminal: "result" | "error";
  readonly error?: ErrorRecord;
  readonly diagnostics: readonly string[];
  readonly cancelled: boolean;
  readonly redactionRevision: string;
  readonly termination: "exited" | "killed" | "failed";
}

export interface SuperviseOptions {
  readonly child: ChildProcess;
  readonly jobId: string;
  readonly attemptId: string;
  readonly limits: Limits;
  readonly pollIntervalMs?: number;
  readonly signal?: AbortSignal;
  readonly artifactDir?: string;
  readonly onChunk?: (chunk: AcceptedChunk) => void | Promise<void>;
}

/**
 * Runs the supervisor loop to completion. The promise resolves with what the
 * engine produced; a protocol violation rejects with the recorded failure while
 * every chunk accepted before it remains readable.
 */
export async function supervise(options: SuperviseOptions): Promise<SupervisedRun> {
  const { child, jobId, attemptId, limits } = options;
  const stdout = child.stdout;
  const stderr = child.stderr;
  if (!stdout || !stderr) throw new ProtocolError("engine process has no stdout or stderr");

  const chunks: AcceptedChunk[] = [];
  const diagnostics: string[] = [];
  const sequence = new SequenceTracker();
  const hello = new HelloGate();
  const watcher = watchLimits(child, limits);
  const exited = new Promise<{ code: number | null; error?: Error }>((resolve) => {
    child.once("error", (error) => resolve({ code: null, error }));
    child.once("close", (code) => resolve({ code }));
  });

  let terminal: "result" | "error" | undefined;
  let terminalError: ErrorRecord | undefined;
  let failure: Error | undefined;
  let cancelled = false;
  let cancellation: Promise<"cooperative" | "killed"> | undefined;
  const abort = () => {
    if (cancelled) return;
    cancelled = true;
    if (child.stdin) cancellation = requestCancellation({ child, stdin: child.stdin, jobId, attemptId, reason: "user-requested" });
    else killProcessTree(child, "SIGKILL");
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();


  const poll = setInterval(() => {
    try {
      watcher.checkWallClock();
      watcher.checkMemory();
      if (options.artifactDir) checkArtifactDirectory(options.artifactDir, limits.maxArtifactBytes);
    } catch (error) {
      failure ??= error as Error;
      killProcessTree(child, "SIGKILL");
    }
  }, options.pollIntervalMs ?? 250);

  const diagnosticParts: string[] = [];
  const drainDiagnostics = (async () => {
    for await (const text of readDiagnostics(stderr, limits.maxOutputBytes, (bytes) => watcher.countOutput(bytes))) {
      diagnosticParts.push(text);
    }
  })().catch((error: unknown) => { failure ??= error instanceof MessageTooLargeError ? new LimitBreach("maxOutputBytes", error.bytes, error.limit) : error as Error; killProcessTree(child, "SIGKILL"); });

  try {
    for await (const line of readLines(stdout, limits.maxMessageBytes, (bytes) => watcher.countOutput(bytes))) {
      let raw: unknown;
      try {
        raw = decodeLine(line);
      } catch {
        throw new ProtocolError("engine emitted a line that is not JSON");
      }
      const envelope: EngineEnvelope = validateEnvelope(raw, { jobId, attemptId });
      hello.accept(envelope.type);
      sequence.accept(envelope.sequence);
      const accepted = {
        type: envelope.type,
        sequence: envelope.sequence,
        payload: envelope.payload,
      };
      if (terminal) throw new ProtocolError("engine sent a message after its terminal record");
      await options.onChunk?.(accepted);
      chunks.push(accepted);
      if (envelope.type === "result") terminal = "result";
      if (envelope.type === "error") {
        terminal = "error";
        terminalError = errorRecord(
          (envelope.payload["code"] as ErrorRecord["code"]) ?? "ENGINE_FAILED",
          String(envelope.payload["message"] ?? "engine reported an error"),
          envelope.payload["details"] as Readonly<Record<string, unknown>> | undefined,
        );
      }
    }
  } catch (error) {
    failure ??= error as Error;
    killProcessTree(child, "SIGKILL");
  } finally {
    await drainDiagnostics;
    const outcome = await exited;
    if (outcome.error) failure ??= outcome.error;
    if (outcome.code !== 0 && terminal !== "error" && !failure) terminalError = errorRecord("ENGINE_FAILED", `engine exited unsuccessfully (${outcome.code ?? "signal"})`);
    if (terminalError && terminal !== "error") terminal = "error";
    diagnostics.push(redact(diagnosticParts.join("")));
    if (options.artifactDir) {
      try { checkArtifactDirectory(options.artifactDir, limits.maxArtifactBytes); }
      catch (error) { failure ??= error as Error; }
    }
    await cancellation;
    options.signal?.removeEventListener("abort", abort);
    clearInterval(poll);
    watcher.stop();
  }

  const metadata = { cancelled, redactionRevision: REDACTION_REVISION };
  if (failure) {
    // A violation of the protocol fails the job: it is reported as an error
    // record, and every chunk accepted before it stays readable. Only an
    // unexpected internal fault propagates.
    if (failure instanceof LimitBreach) {
      return { ...metadata, chunks, terminal: "error", error: failure.record, diagnostics, termination: "killed" };
    }
    if (failure instanceof ProtocolError) {
      return { ...metadata, chunks, terminal: "error", error: failure.record, diagnostics, termination: "failed" };
    }
    if (failure instanceof MessageTooLargeError) {
      return {
        ...metadata,
        chunks,
        terminal: "error",
        error: errorRecord("PROTOCOL_INVALID", failure.message, {
          bytes: failure.bytes,
          limit: failure.limit,
        }),
        diagnostics,
        termination: "failed",
      };
    }
    if (failure instanceof InvalidEncodingError) return { ...metadata, chunks, terminal: "error", error: errorRecord("PROTOCOL_INVALID", failure.message), diagnostics, termination: "failed" };
    return { ...metadata, chunks, terminal: "error", error: errorRecord("ENGINE_FAILED", redact(failure.message)), diagnostics, termination: "failed" };
  }

  if (!hello.opened) {
    return {
      ...metadata,
      chunks,
      terminal: "error",
      error: errorRecord("PROTOCOL_INVALID", "the engine sent no hello"),
      diagnostics,
      termination: "failed",
    };
  }

  return {
    ...metadata,
    chunks,
    ...(terminal ? { terminal } : { terminal: "error" as const }),
    ...(terminalError ? { error: terminalError } : {}),
    diagnostics,
    termination: "exited",
  };
}
