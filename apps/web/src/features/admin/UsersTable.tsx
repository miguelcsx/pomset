"use client";

import { useEffect, useState } from "react";

import { failureMessage } from "../common/http";
import type { Page } from "../common/page";
import { usePageParam } from "../common/use-page-param";
import { formatDate } from "../scripts/ScriptsPanel";
import { Pager } from "../ui/Pager";
import { errorText, panel, tableCell, tableHead } from "../ui/classes";
import type { Account } from "../auth/account";
import { listUsers, USERS_PAGE_SIZE } from "./admin-api";

export function UsersTable() {
  const [page, setPage] = usePageParam("usersPage");
  const [data, setData] = useState<Page<Account>>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError(undefined);
    listUsers(page, USERS_PAGE_SIZE)
      .then((value) => {
        if (live) setData(value);
      })
      .catch((failure: unknown) => {
        if (live) setError(failureMessage(failure));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [page]);

  return (
    <section aria-labelledby="users-title">
      <h1 id="users-title" className="text-2xl font-semibold tracking-tight text-ink">
        Users
      </h1>
      {error && (
        <p role="alert" className={`${errorText} mt-4`}>
          {error}
        </p>
      )}
      {data && (
        <div className={`${panel} mt-6 overflow-x-auto`}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={tableHead}>
                  Name
                </th>
                <th scope="col" className={tableHead}>
                  Email
                </th>
                <th scope="col" className={tableHead}>
                  Role
                </th>
                <th scope="col" className={tableHead}>
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((account) => (
                <tr key={account.id}>
                  <td className={tableCell}>{account.displayName}</td>
                  <td className={`${tableCell} text-muted`}>{account.email}</td>
                  <td className={tableCell}>{account.role}</td>
                  <td className={`${tableCell} text-muted`}>{formatDate(account.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.pagination.totalPages > 1 && (
        <Pager
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          busy={busy}
          onPage={setPage}
        />
      )}
    </section>
  );
}
