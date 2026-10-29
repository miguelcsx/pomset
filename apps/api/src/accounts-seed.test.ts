/**
 * The demo accounts are created once. A restart with different passwords, or
 * after an operator has changed a role by hand, leaves the stored account as it was.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";

import { DEMO_ADMIN, DEMO_USER } from "./application/accounts/SeedDemoAccounts.js";
import { BcryptPasswordHasher } from "./infrastructure/accounts/BcryptPasswordHasher.js";
import { openAccountsStore } from "./infrastructure/accounts/openAccountsStore.js";
import { startWorkbench } from "./main.js";

const directory = mkdtempSync(join(tmpdir(), "pomset-seed-test-"));
const FIRST_ADMIN = "first administrator passphrase";
const FIRST_USER = "first user passphrase";
const SECOND_ADMIN = "second administrator passphrase";
const SECOND_USER = "second user passphrase";

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

it("creates the demo accounts once, and a restart changes neither their password nor their role", async () => {
  const first = await startWorkbench({
    directory,
    demoAccounts: { admin: FIRST_ADMIN, user: FIRST_USER },
  });
  const before = await openAccountsStore(join(directory, "accounts.sqlite"));
  await before.prisma.user.update({ where: { email: DEMO_USER.email }, data: { role: "admin" } });
  await before.close();
  await first.close();

  const second = await startWorkbench({
    directory,
    demoAccounts: { admin: SECOND_ADMIN, user: SECOND_USER },
  });
  const after = await openAccountsStore(join(directory, "accounts.sqlite"));
  try {
    const users = await after.prisma.user.findMany({
      where: { email: { in: [DEMO_ADMIN.email, DEMO_USER.email] } },
    });
    expect(users).toHaveLength(2);

    const admin = users.find((user) => user.email === DEMO_ADMIN.email)!;
    const user = users.find((account) => account.email === DEMO_USER.email)!;
    const hasher = new BcryptPasswordHasher();
    expect(await hasher.verify(FIRST_ADMIN, admin.passwordHash)).toBe(true);
    expect(await hasher.verify(SECOND_ADMIN, admin.passwordHash)).toBe(false);
    expect(await hasher.verify(FIRST_USER, user.passwordHash)).toBe(true);
    expect(user.role).toBe("admin");
  } finally {
    await after.close();
    await second.close();
  }
}, 60000);

it("refuses a demo password that the account rules would refuse, and leaves the store usable", async () => {
  await expect(
    startWorkbench({ directory, demoAccounts: { admin: "short", user: FIRST_USER } }),
  ).rejects.toThrow(`Demo password for ${DEMO_ADMIN.email}`);

  const running = await startWorkbench({ directory });
  await running.close();
}, 60000);
