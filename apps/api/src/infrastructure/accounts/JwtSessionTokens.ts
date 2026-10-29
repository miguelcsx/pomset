/**
 * HS256 session tokens. The algorithm is pinned on verification, so a token
 * that names `none` or an asymmetric algorithm is refused rather than trusted.
 * Issuer and audience keep a token minted for another service from being accepted here.
 */

import jwt from "jsonwebtoken";

import type { SessionTokens } from "../../application/ports/SessionTokens.js";

const ISSUER = "pomset-workbench";
const AUDIENCE = "pomset-workbench";
export const SESSION_LIFETIME = "2h";

export class JwtSessionTokens implements SessionTokens {
  constructor(private readonly secret: string) {}

  issue(accountId: string): string {
    return jwt.sign({}, this.secret, {
      subject: accountId,
      algorithm: "HS256",
      expiresIn: SESSION_LIFETIME,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  }

  verify(token: string): string | undefined {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}
