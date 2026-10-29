/** The administrator's view of every account. It never includes a password hash. */

import { pageOf, type Page, type PageRequest, window } from "../../domain/pagination.js";
import type { Account } from "../../domain/accounts/Account.js";
import type { UserRepository } from "../ports/UserRepository.js";

export class ListUsers {
  constructor(private readonly users: UserRepository) {}

  async execute(request: PageRequest): Promise<Page<Account>> {
    const { items, total } = await this.users.list(window(request));
    return pageOf(request, items, total);
  }
}
