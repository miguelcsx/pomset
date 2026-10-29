"use client";

/**
 * The account controls at the end of the workbench toolbar. Signed out, they
 * offer sign-in. Signed in, they save the entrypoint as a script, keep the
 * analysis on screen under one of the account's scripts, and link to the
 * account pages. The workbench's own state is never changed here.
 */

import type { Scenario } from "@pomset/contracts";
import Link from "next/link";
import { useState } from "react";

import { signOut } from "../auth/auth-api";
import { authHref, currentPath } from "../auth/navigation";
import { useBrowserLocation } from "../auth/use-browser-location";
import { useSession } from "../auth/use-session";
import { asObject } from "../common/json";
import { scriptTitle } from "../scenario/scenario-draft";
import { SaveResultDialog } from "./SaveResultDialog";
import { SaveScriptDialog } from "./SaveScriptDialog";
import type { SavedScript } from "./scripts-api";

export interface WorkbenchAccountProps {
  /** The entrypoint's source from the working copy. */
  readonly source: string;
  readonly scenario: Scenario;
  readonly fileCount: number;
  /** The job behind the analysis on screen. Undefined for a report that was opened from a file. */
  readonly analysisId?: string | undefined;
}

export function WorkbenchAccount(props: WorkbenchAccountProps) {
  const state = useSession();
  const here = useBrowserLocation();
  const [dialog, setDialog] = useState<"script" | "result">();
  const [notice, setNotice] = useState<string>();

  if (state.status === "loading") return null;

  if (state.status === "signed-out") {
    return (
      <div className="ide-account">
        <Link className="ide-account-button" href={authHref("/login", currentPath(), here.fragment)}>
          Sign in
        </Link>
      </div>
    );
  }

  const { session } = state;
  const at = (path: string) => `${path}${here.fragment}`;
  const otherFiles = props.fileCount > 1 ? "Only the entrypoint file is saved. The other files stay in this workspace." : undefined;

  return (
    <div className="ide-account" role="group" aria-label="Account">
      <span className="ide-account-user">{session.user.displayName}</span>
      <button type="button" className="ide-account-button" onClick={() => setDialog("script")}>
        Save as script
      </button>
      <button
        type="button"
        className="ide-account-button"
        disabled={!props.analysisId}
        title={props.analysisId ? "Keep this analysis under one of your scripts" : "Run an analysis to keep its result"}
        onClick={() => setDialog("result")}
      >
        Save result
      </button>
      <Link className="ide-account-button" href={at("/mis-scripts/")}>
        My scripts
      </Link>
      <button type="button" className="ide-account-button" onClick={() => signOut()}>
        Sign out
      </button>
      {notice && (
        <span role="status" className="ide-account-notice">
          {notice}
        </span>
      )}
      <SaveScriptDialog
        open={dialog === "script"}
        suggestedTitle={scriptTitle(props.scenario)}
        note={otherFiles}
        source={props.source}
        scenario={asObject(props.scenario)}
        onClose={() => setDialog(undefined)}
        onSaved={(script: SavedScript) => {
          setDialog(undefined);
          setNotice(`Saved as ${script.title}`);
        }}
      />
      {props.analysisId && (
        <SaveResultDialog
          open={dialog === "result"}
          analysisId={props.analysisId}
          onClose={() => setDialog(undefined)}
          onSaved={(message) => {
            setDialog(undefined);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
