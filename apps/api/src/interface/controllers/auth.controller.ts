/**
 * The account routes' handlers: registration, sign-in and the current account.
 *
 * A session is returned as `{ token, user }`. The token is the only credential
 * the browser keeps, and the user is what it shows, so one request is enough to
 * start a session.
 */

import type { Platform } from "../../application/Platform.js";
import { asyncRoute } from "../middlewares/async-route.js";
import { currentAccount } from "../middlewares/authenticate.middleware.js";

export function authController(platform: Platform) {
  return {
    register: asyncRoute(async (request, response) => {
      response.status(201).json({ data: await platform.register.execute(request.body) });
    }),

    signIn: asyncRoute(async (request, response) => {
      response.json({ data: await platform.signIn.execute(request.body) });
    }),

    me: asyncRoute(async (_request, response) => {
      response.json({ data: currentAccount(response) });
    }),
  };
}
