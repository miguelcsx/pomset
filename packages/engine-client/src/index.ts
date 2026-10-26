/**
 * `@pomset/engine-client` owns the engine process boundary and nothing else. An
 * engine is a child process speaking JSON Lines over stdin and stdout; it is not
 * a service, and no Python HTTP microservice sits behind this boundary.
 *
 * The supervisor owns the process, the lifecycle and the limits; the engine owns
 * analysis only, and holds no accounts, no publication rights and no network
 * access in hosted operation.
 */

export * from "./cancel.js";
export * from "./codec.js";
export * from "./consent.js";
export * from "./envelope.js";
export * from "./errors.js";
export * from "./launch.js";
export * from "./limits.js";
export * from "./mounts.js";
export * from "./process-tree.js";
export * from "./redact.js";
export * from "./request.js";
export * from "./supervise.js";

/** The initial engine protocol version, carried by every engine message. */
export const PROTOCOL_VERSION = 1 as const;

export * from "./deployment.js";
export * from "./profile.js";
