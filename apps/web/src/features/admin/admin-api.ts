/**
 * The administrator's view of the accounts. The API refuses every call from an
 * account without the admin role, so this module only has to send the token.
 */

import { apiRequest } from "../common/http";
import { parsePage, type Page } from "../common/page";
import { parseAccount, type Account } from "../auth/account";

export const USERS_PAGE_SIZE = 20;

export async function listUsers(page: number, pageSize = USERS_PAGE_SIZE): Promise<Page<Account>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await apiRequest(`/api/admin/users?${query.toString()}`, { auth: "required" });
  return parsePage(response, parseAccount);
}
