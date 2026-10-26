import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

import { decodeLine, encodeMessage, MessageTooLargeError, readLines } from "./codec.js";
import { requestCancellation } from "./cancel.js";
import { requireConsent, ConsentRequiredError, requestNeedsConsent } from "./consent.js";
import { HelloGate, ProtocolError, SequenceTracker, validateEnvelope } from "./envelope.js";
import { applyBudget, DEFAULT_BUDGET } from "./request.js";
import { buildMountPlan } from "./mounts.js";
import { redact, redactionLabels, REDACTION_REVISION } from "./redact.js";
import { supervise } from "./supervise.js";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";

const JOB = "job_1";
const ATTEMPT = "att_1";

function envelope(sequence: number, type: string, payload: Record<string, unknown> = type === "hello" ? { engineName: "fixture", engineVersion: "1", capabilities: [] } : {}): unknown {
  return { protocolVersion: 1, jobId: JOB, attemptId: ATTEMPT, sequence, type, payload };
}

/** An engine that speaks the protocol over stdout, as a real child process. */
const WELL_BEHAVED_ENGINE = `
const send = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
const base = { protocolVersion: 1, jobId: ${JSON.stringify(JOB)}, attemptId: ${JSON.stringify(ATTEMPT)} };
send({ ...base, sequence: 1, type: "hello", payload: { engineName: "fixture", engineVersion: "1", capabilities: [] } });
send({ ...base, sequence: 2, type: "progress", payload: { phase: "solve", completed: 1, total: 2 } });
process.stderr.write("Bearer abcdefghijklmnop\\n");
send({ ...base, sequence: 3, type: "result", payload: ${JSON.stringify({ ...JSON.parse(readFileSync(new URL("../../../docs/contracts/examples/analysis-result.json", import.meta.url), "utf8")), jobId: JOB, attemptId: ATTEMPT })} });
`;

async function runEngine(script: string, limits = DEFAULT_BUDGET) {
  const child = spawn(process.execPath, ["-e", script], { stdio: ["pipe", "pipe", "pipe"], detached: true });
  try {
    return await supervise({ child, jobId: JOB, attemptId: ATTEMPT, limits, pollIntervalMs: 50 });
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

describe("the JSON Lines codec", () => {
  it("round-trips a message", () => {
    const encoded = encodeMessage({ a: 1 });
    expect(encoded.toString("utf8")).toBe('{"a":1}\n');
    expect(decodeLine(encoded.toString("utf8").trim())).toEqual({ a: 1 });
  });

  it("refuses a message over the size limit", () => {
    expect(() => encodeMessage({ big: "x".repeat(100) }, 10)).toThrow(MessageTooLargeError);
  });

  it("yields a final line with no trailing newline", async () => {
    const lines: string[] = [];
    for await (const line of readLines(Readable.from(["a\nb"]))) lines.push(line);
    expect(lines).toEqual(["a", "b"]);
  });
  it("bounds an unfinished line before EOF", async () => {
    const stream = Readable.from([Buffer.alloc(7, 97), Buffer.alloc(7, 97)]);
    await expect((async () => { for await (const _line of readLines(stream, 10)) { /* no line may be accepted */ } })()).rejects.toThrow(MessageTooLargeError);
  });
  it("decodes split UTF-8 only after complete line assembly", async () => {
    const bytes = Buffer.from('{"text":"🦀"}\n');
    const lines = [];
    for await (const line of readLines(Readable.from([bytes.subarray(0, 12), bytes.subarray(12)]))) lines.push(line);
    expect(JSON.parse(lines[0] as string)).toEqual({ text: "🦀" });
  });
});

describe("the envelope and its sequence", () => {
  it("accepts a well-formed message", () => {
    expect(validateEnvelope(envelope(1, "hello"), { jobId: JOB, attemptId: ATTEMPT }).type).toBe("hello");
  });

  it("refuses a mismatched protocol version", () => {
    const wrong = { ...(envelope(1, "hello") as object), protocolVersion: 2 };
    expect(() => validateEnvelope(wrong, { jobId: JOB, attemptId: ATTEMPT })).toThrow(ProtocolError);
  });

  it("refuses a message naming another job", () => {
    const other = { ...(envelope(1, "hello") as object), jobId: "job_9" };
    expect(() => validateEnvelope(other, { jobId: JOB, attemptId: ATTEMPT })).toThrow(ProtocolError);
  });

  it("refuses a duplicate or skipped sequence", () => {
    const tracker = new SequenceTracker();
    tracker.accept(1);
    expect(() => tracker.accept(1)).toThrow(ProtocolError);
    expect(() => tracker.accept(3)).toThrow(ProtocolError);
    tracker.accept(2);
  });

  it("requires exactly one opening hello", () => {
    const gate = new HelloGate();
    expect(() => gate.accept("progress")).toThrow(ProtocolError);
    gate.accept("hello");
    expect(() => gate.accept("hello")).toThrow(ProtocolError);
    gate.accept("result");
  });
});

describe("the engine request", () => {
  it("accepts a lowered budget", () => {
    const budget = applyBudget({ solverTimeMs: 1_000 });
    expect(budget).not.toBeInstanceOf(Error);
    expect((budget as typeof DEFAULT_BUDGET).solverTimeMs).toBe(1_000);
  });

  it("refuses a raised budget", () => {
    const budget = applyBudget({ memoryBytes: DEFAULT_BUDGET.memoryBytes + 1 });
    expect(budget).toBeInstanceOf(Error);
  });
});

describe("input mounting", () => {
  it("refuses an absolute path", () => {
    const plan = buildMountPlan({
      inputs: [{ kind: "files", path: "/etc/passwd" }],
      scratchDir: "/scratch",
      artifactDir: "/artifacts",
    });
    expect(Array.isArray(plan)).toBe(true);
  });

  it("refuses a traversal path", () => {
    const plan = buildMountPlan({
      inputs: [{ kind: "files", path: "../outside" }],
      scratchDir: "/scratch",
      artifactDir: "/artifacts",
    });
    expect(Array.isArray(plan)).toBe(true);
  });
});

describe("secret redaction", () => {
  it("marks a bearer token, a connection string and a private key", () => {
    const text = [
      "Authorization: Bearer abcdefghijklmnop",
      "postgres://user:hunter2@db.internal:5432/pomset",
      "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const redacted = redact(text);
    expect(redacted).not.toContain("abcdefghijklmnop");
    expect(redacted).not.toContain("hunter2");
    expect(redacted).not.toContain("MIIE");
    expect(redacted).toContain("[redacted:");
  });

  it("leaves an unremarkable line alone", () => {
    expect(redact("compiling kernel.py")).toBe("compiling kernel.py");
  });

  it("records a revision and is idempotent", () => {
    expect(REDACTION_REVISION).toBe("2");
    expect(redactionLabels()).toContain("bearer-token");
    const once = redact("Bearer abcdefghijklmnop");
    expect(redact(once)).toBe(once);
  });
});

describe("local execution consent", () => {
  it("refuses an executing operation without the flag", () => {
    expect(requestNeedsConsent("replay")).toBe(true);
    expect(() => requireConsent("replay", false)).toThrow(ConsentRequiredError);
    expect(() => requireConsent("parse", false)).not.toThrow();
  });
});

describe("supervising a real engine process", () => {
  it("accepts a well-formed run and keeps its chunks in order", async () => {
    const run = await runEngine(WELL_BEHAVED_ENGINE);
    expect(run.terminal).toBe("result");
    expect(run.chunks.map((chunk) => chunk.type)).toEqual(["hello", "progress", "result"]);
    expect(run.chunks.map((chunk) => chunk.sequence)).toEqual([1, 2, 3]);
  });

  it("redacts captured diagnostics on the way in", async () => {
    const run = await runEngine(WELL_BEHAVED_ENGINE);
    expect(run.diagnostics.join("")).not.toContain("abcdefghijklmnop");
    expect(run.diagnostics.join("")).toContain("[redacted:bearer-token]");
  });
  it("redacts secrets split across stderr writes", async () => {
    const split = WELL_BEHAVED_ENGINE.replace('process.stderr.write("Bearer abcdefghijklmnop\\n");', 'process.stderr.write("Bearer abc"); process.stderr.write("defghijklmnop\\n");');
    const run = await runEngine(split);
    expect(run.diagnostics.join("")).not.toContain("abcdefghijklmnop");
    expect(run.diagnostics.join("")).toContain("[redacted:bearer-token]");
  });
  it("rejects an invalid terminal payload and preserves prior accepted chunks", async () => {
    const broken = WELL_BEHAVED_ENGINE.replace(/send\(\{ \.\.\.base, sequence: 3,[\s\S]*$/, 'send({ ...base, sequence: 3, type: "result", payload: {} });');
    const run = await runEngine(broken);
    expect(run.error?.code).toBe("PROTOCOL_INVALID");
    expect(run.chunks.map((chunk) => chunk.type)).toEqual(["hello", "progress"]);
  });
  it("does not treat a result followed by an unsuccessful exit as success", async () => {
    const run = await runEngine(WELL_BEHAVED_ENGINE + "\nprocess.exitCode = 1;");
    expect(run.terminal).toBe("error");
    expect(run.error?.code).toBe("ENGINE_FAILED");
  });

  it("fails the job on a protocol violation and keeps accepted chunks readable", async () => {
    const broken = `
      const send = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
      const base = { protocolVersion: 1, jobId: ${JSON.stringify(JOB)}, attemptId: ${JSON.stringify(ATTEMPT)} };
      send({ ...base, sequence: 1, type: "hello", payload: { engineName: "fixture", engineVersion: "1", capabilities: [] } });
      send({ ...base, sequence: 3, type: "progress", payload: {} });
    `;
    const run = await runEngine(broken);
    expect(run.terminal).toBe("error");
    expect(run.error?.code).toBe("PROTOCOL_INVALID");
    // The hello accepted before the gap survives the violation.
    expect(run.chunks.map((chunk) => chunk.type)).toEqual(["hello"]);
  });

  it("refuses a first message that is not a hello", async () => {
    const noHello = `
      const send = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
      const base = { protocolVersion: 1, jobId: ${JSON.stringify(JOB)}, attemptId: ${JSON.stringify(ATTEMPT)} };
      send({ ...base, sequence: 1, type: "progress", payload: {} });
    `;
    const run = await runEngine(noHello);
    expect(run.terminal).toBe("error");
    expect(run.error?.code).toBe("PROTOCOL_INVALID");
  });

  it("kills an engine that ignores the cooperative cancel", async () => {
    // A Node engine that traps SIGTERM, so only the escalation stops it. It
    // announces readiness, because a signal delivered before the handler is
    // installed would be a test race rather than a property of the supervisor.
    const stubborn = `process.on("SIGTERM", () => {}); process.stdout.write("ready\\n"); setInterval(() => {}, 1000);`;
    const child = spawn(process.execPath, ["-e", stubborn], {
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    await new Promise<void>((resolve) => child.stdout!.once("data", () => resolve()));

    const outcome = await requestCancellation({
      child,
      stdin: child.stdin!,
      jobId: JOB,
      attemptId: ATTEMPT,
      reason: "user-requested",
      graceMs: 250,
    });
    expect(outcome).toBe("killed");
    // A signal-terminated process reports signalCode, not exitCode.
    expect(child.signalCode).toBe("SIGKILL");
  });



});
