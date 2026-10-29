/**
 * The application layer as one object the interface layer receives.
 *
 * Each use case is built here from the ports it declares, so no controller
 * constructs its own collaborators and a store is replaced in the composition
 * root alone.
 */

import type { AnalysisOwners } from "./ports/AnalysisOwners.js";
import type { PasswordHasher } from "./ports/PasswordHasher.js";
import type { ResultRepository } from "./ports/ResultRepository.js";
import type { ScriptRepository } from "./ports/ScriptRepository.js";
import type { SessionTokens } from "./ports/SessionTokens.js";
import type { UserRepository } from "./ports/UserRepository.js";
import { RegisterAccount } from "./accounts/RegisterAccount.js";
import { ResolveSession } from "./accounts/ResolveSession.js";
import { SignIn } from "./accounts/SignIn.js";
import { ListUsers } from "./accounts/ListUsers.js";
import { OwnedAnalyses } from "./analyses/OwnedAnalyses.js";
import { ScriptLibrary } from "./library/ScriptLibrary.js";
import { SavedResults } from "./library/SavedResults.js";
import type { Workbench } from "./Workbench.js";

export interface PlatformDependencies {
  readonly workbench: Workbench;
  readonly users: UserRepository;
  readonly scripts: ScriptRepository;
  readonly results: ResultRepository;
  readonly owners: AnalysisOwners;
  readonly hasher: PasswordHasher;
  readonly tokens: SessionTokens;
  readonly now?: () => Date;
}

export interface Platform {
  readonly workbench: Workbench;
  readonly register: RegisterAccount;
  readonly signIn: SignIn;
  readonly resolveSession: ResolveSession;
  readonly users: ListUsers;
  readonly scripts: ScriptLibrary;
  readonly results: SavedResults;
  readonly analyses: OwnedAnalyses;
}

export function createPlatform(deps: PlatformDependencies): Platform {
  const now = deps.now ?? (() => new Date());
  const scripts = new ScriptLibrary(deps.scripts, now);
  return {
    workbench: deps.workbench,
    register: new RegisterAccount({ users: deps.users, hasher: deps.hasher, tokens: deps.tokens, now }),
    signIn: new SignIn({ users: deps.users, hasher: deps.hasher, tokens: deps.tokens }),
    resolveSession: new ResolveSession({ users: deps.users, tokens: deps.tokens }),
    users: new ListUsers(deps.users),
    scripts,
    results: new SavedResults({
      scripts,
      results: deps.results,
      owners: deps.owners,
      analyses: { report: (id) => deps.workbench.report.execute(id) },
      now,
    }),
    analyses: new OwnedAnalyses({ workbench: deps.workbench, owners: deps.owners, now }),
  };
}
