import { Router } from "express";

import type { Platform } from "../../application/Platform.js";
import type { FixedWindowLimiter } from "../../infrastructure/limits/FixedWindowLimiter.js";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { byAddress, byEmail, limitAttempts } from "../middlewares/rate-limit.middleware.js";

/** The limiters behind each account route. Each is shared by every request that reaches it. */
export interface AuthLimits {
  readonly register: FixedWindowLimiter;
  readonly signIn: FixedWindowLimiter;
  readonly signInByEmail: FixedWindowLimiter;
}

export function authRouter(platform: Platform, limits: AuthLimits): Router {
  const router = Router();
  const controller = authController(platform);

  router.post(
    "/register",
    limitAttempts({ limiter: limits.register, keyOf: byAddress }),
    controller.register,
  );
  router.post(
    "/login",
    limitAttempts(
      { limiter: limits.signIn, keyOf: byAddress },
      { limiter: limits.signInByEmail, keyOf: byEmail },
    ),
    controller.signIn,
  );
  router.get("/me", authenticate(platform.resolveSession), controller.me);

  return router;
}
