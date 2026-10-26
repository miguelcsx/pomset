/**
 * Monaco keeps the two modules that decide whether Tab moves focus behind deep
 * ESM paths it does not re-export from `editor.api`. The editor mounts them
 * deliberately; see `features/editor/SourceEditor.tsx`. The package declares no
 * `exports` map, so the paths resolve.
 */

declare module "monaco-editor/esm/vs/editor/browser/config/tabFocus.js" {
  export const TabFocus: {
    getTabFocusMode(): boolean;
    setTabFocusMode(tabFocusMode: boolean): void;
  };
}

declare module "monaco-editor/esm/vs/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js";
