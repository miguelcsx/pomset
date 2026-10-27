/**
 * Where a workbench answers, and from which origin its browser may come.
 *
 * A local workbench answers only its loopback names on its own port, over plain
 * HTTP. A public one answers the single hostname its platform routes to it, over
 * the HTTPS that the platform terminates. Each endpoint pairs a Host with the one
 * Origin that may accompany it, so a page served from any other name is refused
 * even when it reaches the socket.
 */

export interface Endpoint {
  readonly host: string;
  readonly origin: string;
}

export type Exposure = readonly Endpoint[];

export function loopbackExposure(port: number): Exposure {
  return [
    { host: `127.0.0.1:${port}`, origin: `http://127.0.0.1:${port}` },
    { host: `localhost:${port}`, origin: `http://localhost:${port}` },
  ];
}

export function publicExposure(hostname: string): Exposure {
  return [{ host: hostname, origin: `https://${hostname}` }];
}

/** True when the Host and the Origin name the same endpoint. */
export function isSameOrigin(
  exposure: Exposure,
  host: string | undefined,
  origin: string | undefined,
): boolean {
  return exposure.some((endpoint) => endpoint.host === host && endpoint.origin === origin);
}
