/**
 * The saved-script and saved-result handlers.
 *
 * Every handler reads the signed-in account from `response.locals`, which the
 * authenticate middleware set, and passes its id to the use case. Ownership is
 * decided there, so a handler never compares ids itself.
 *
 * A delete answers 204 with no body: the resource is gone, and there is nothing
 * left to return.
 */

import type { Response } from "express";

import type { Platform } from "../../application/Platform.js";
import { parsePageRequest } from "../../domain/pagination.js";
import { asyncRoute } from "../middlewares/async-route.js";
import { currentAccount } from "../middlewares/authenticate.middleware.js";

export function scriptsController(platform: Platform) {
  const accountId = (response: Response): string => currentAccount(response).id;

  return {
    list: asyncRoute(async (request, response) => {
      const page = parsePageRequest(request.query);
      response.json({ data: await platform.scripts.list(accountId(response), page) });
    }),

    create: asyncRoute(async (request, response) => {
      response.status(201).json({ data: await platform.scripts.create(accountId(response), request.body) });
    }),

    get: asyncRoute(async (request, response) => {
      response.json({ data: await platform.scripts.get(accountId(response), request.params["id"]!) });
    }),

    update: asyncRoute(async (request, response) => {
      const id = request.params["id"]!;
      response.json({ data: await platform.scripts.update(accountId(response), id, request.body) });
    }),

    remove: asyncRoute(async (request, response) => {
      await platform.scripts.remove(accountId(response), request.params["id"]!);
      response.status(204).end();
    }),

    listResults: asyncRoute(async (request, response) => {
      const page = parsePageRequest(request.query);
      const scriptId = request.params["id"]!;
      response.json({ data: await platform.results.list(accountId(response), scriptId, page) });
    }),

    saveResult: asyncRoute(async (request, response) => {
      const scriptId = request.params["id"]!;
      const saved = await platform.results.save(accountId(response), scriptId, request.body);
      response.status(201).json({ data: saved });
    }),

    getResult: asyncRoute(async (request, response) => {
      const result = await platform.results.get(
        accountId(response),
        request.params["id"]!,
        request.params["resultId"]!,
      );
      response.json({ data: result });
    }),

    removeResult: asyncRoute(async (request, response) => {
      await platform.results.remove(
        accountId(response),
        request.params["id"]!,
        request.params["resultId"]!,
      );
      response.status(204).end();
    }),
  };
}
