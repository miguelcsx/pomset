/**
 * The analysis routes' handlers.
 *
 * A payload is returned under `data` and a failure under `error`, so a caller
 * never has to guess which it received. Each handler delegates to the owned
 * analyses use case, which decides who may see what; a status code is chosen
 * here only where the HTTP contract itself decides it, such as the 202 that says
 * the work has been accepted rather than finished.
 */

import type { Platform } from "../../application/Platform.js";
import { asyncRoute } from "../middlewares/async-route.js";
import { currentAccount } from "../middlewares/authenticate.middleware.js";

export function analysesController(platform: Platform) {
  return {
    history: asyncRoute(async (_request, response) => {
      response.json({ data: await platform.analyses.history(currentAccount(response).id) });
    }),

    submit: asyncRoute(async (request, response) => {
      const job = await platform.analyses.submit(currentAccount(response).id, request.body);
      response.status(202).json({ data: job });
    }),

    get: asyncRoute(async (request, response) => {
      response.json({ data: await platform.analyses.report(currentAccount(response).id, request.params["id"]!) });
    }),

    cancel: asyncRoute(async (request, response) => {
      response.json({ data: await platform.analyses.cancel(currentAccount(response).id, request.params["id"]!) });
    }),
  };
}
