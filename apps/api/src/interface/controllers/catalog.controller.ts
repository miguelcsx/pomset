/**
 * The catalog's handlers. Reads are public. Writes are mounted behind
 * `requireRole("admin")` and saving a copy behind `authenticate`, so none of
 * these handlers checks who is calling.
 *
 * A delete answers 204 with no body, as the scripts do.
 */

import type { Platform } from "../../application/Platform.js";
import { pageBody, parsePageRequest } from "../../domain/pagination.js";
import { asyncRoute } from "../middlewares/async-route.js";
import { currentAccount } from "../middlewares/authenticate.middleware.js";

export function catalogController(platform: Platform) {
  return {
    list: asyncRoute(async (request, response) => {
      response.json(pageBody(await platform.catalog.list(parsePageRequest(request.query))));
    }),

    get: asyncRoute(async (request, response) => {
      response.json({ data: await platform.catalog.get(request.params["id"]!) });
    }),

    create: asyncRoute(async (request, response) => {
      response.status(201).json({ data: await platform.catalog.create(request.body) });
    }),

    update: asyncRoute(async (request, response) => {
      response.json({ data: await platform.catalog.update(request.params["id"]!, request.body) });
    }),

    remove: asyncRoute(async (request, response) => {
      await platform.catalog.remove(request.params["id"]!);
      response.status(204).end();
    }),

    saveToScripts: asyncRoute(async (request, response) => {
      const saved = await platform.catalog.saveToScripts(currentAccount(response).id, request.params["id"]!);
      response.status(201).json({ data: saved });
    }),
  };
}
