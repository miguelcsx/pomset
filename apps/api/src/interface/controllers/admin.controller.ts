/** The administrator's handlers. Mounted behind `requireRole("admin")`, so none of them checks a role itself. */

import type { Platform } from "../../application/Platform.js";
import { parsePageRequest } from "../../domain/pagination.js";
import { asyncRoute } from "../middlewares/async-route.js";

export function adminController(platform: Platform) {
  return {
    listUsers: asyncRoute(async (request, response) => {
      response.json({ data: await platform.users.execute(parsePageRequest(request.query)) });
    }),
  };
}
