import { useEffect, useRef, useState } from "react";
import { Icon } from "@pomset/ui";
import type { CloseMode } from "./tab-state.js";
interface Props {
  paths: readonly string[];
  closed: readonly string[];
  active: string;
  canReopen: boolean;
  onSelect: (path: string) => void;
  onClose: (path: string, mode: CloseMode) => void;
  onReopen: () => void;
  onImportScenario: () => void;
}
export function FileTabs({
  paths,
  closed,
  active,
  canReopen,
  onSelect,
  onClose,
  onReopen,
  onImportScenario,
}: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const fileMenu = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{
    path: string;
    x: number;
    y: number;
    files?: boolean;
  }>();
  const visible = paths.filter((path) => !closed.includes(path));
  useEffect(() => {
    const tab = strip.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, visible.join("\n")]);
  useEffect(() => {
    if (!menu) return;
    popup.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node)) setMenu(undefined);
    };
    const dismiss = () => setMenu(undefined);
    window.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
    };
  }, [menu]);
  function focusActive() {
    requestAnimationFrame(() =>
      (
        strip.current?.querySelector<HTMLElement>('[aria-selected="true"]') ??
        fileMenu.current
      )?.focus(),
    );
  }
  function action(run: () => void) {
    setMenu(undefined);
    run();
    focusActive();
  }
  function context(path: string, x: number, y: number) {
    setMenu({
      path,
      x: Math.max(4, Math.min(x, innerWidth - 220)),
      y: Math.max(4, Math.min(y, innerHeight - 230)),
    });
  }
  return (
    <div className="editor-tabs-toolbar">
      <div
        className="editor-tab-strip"
        ref={strip}
        role="tablist"
        aria-label="Open files"
      >
        {visible.map((path, index) => {
          const name = path.split("/").at(-1)!;
          const label =
            paths.filter((item) => item.split("/").at(-1) === name).length > 1
              ? path
              : name;
          return (
            <div
              className="editor-tab"
              key={path}
              data-active={active === path}
              onContextMenu={(event) => {
                event.preventDefault();
                context(path, event.clientX, event.clientY);
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(path, "one");
                }
              }}
            >
              <button
                role="tab"
                aria-selected={active === path}
                tabIndex={
                  active === path || (!visible.includes(active) && index === 0)
                    ? 0
                    : -1
                }
                title={path}
                onClick={() => onSelect(path)}
                onKeyDown={(event) => {
                  if (
                    event.key === "ContextMenu" ||
                    (event.shiftKey && event.key === "F10")
                  ) {
                    event.preventDefault();
                    const box = event.currentTarget.getBoundingClientRect();
                    context(path, box.left, box.bottom);
                  }
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? visible.length - 1
                          : (index +
                              (event.key === "ArrowRight" ? 1 : -1) +
                              visible.length) %
                            visible.length;
                    onSelect(visible[next]!);
                    focusActive();
                  }
                  if (event.key === "Delete") {
                    event.preventDefault();
                    onClose(path, "one");
                    focusActive();
                  }
                }}
              >
                <Icon name="file" size={13} />
                <span>{label}</span>
              </button>
              <button
                className="tab-close"
                aria-label={`Close ${path}`}
                title="Close tab"
                onClick={() => onClose(path, "one")}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="tab-tools">
        <button
          ref={fileMenu}
          className="icon-button"
          aria-label="Workspace files"
          title="Workspace files · reopen closed tabs"
          aria-haspopup="menu"
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            setMenu({
              path: active,
              x: Math.max(4, Math.min(box.right - 220, innerWidth - 224)),
              y: box.bottom,
              files: true,
            });
          }}
        >
          <Icon name="folder" size={14} />
        </button>
        <button
          className="icon-button"
          aria-label="Import scenario"
          title="Import scenario"
          onClick={onImportScenario}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>
      {menu && (
        <div
          ref={popup}
          className="editor-tab-menu"
          role="menu"
          aria-label={menu.files ? "Workspace files" : "File actions"}
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") {
              setMenu(undefined);
              if (event.key === "Escape") {
                event.preventDefault();
                focusActive();
              }
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const buttons = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              ];
              const index = buttons.indexOf(
                window.document.activeElement as HTMLButtonElement,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            }
          }}
        >
          {menu.files ? (
            paths.map((path) => (
              <button
                role="menuitem"
                key={path}
                title={path}
                onClick={() => action(() => onSelect(path))}
              >
                <Icon name="file" size={14} />
                <span>{path}</span>
                {!closed.includes(path) && <Icon name="check" size={12} />}
              </button>
            ))
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => action(() => onClose(menu.path, "one"))}
              >
                Close tab
              </button>
              <button
                role="menuitem"
                onClick={() => action(() => onClose(menu.path, "others"))}
              >
                Close other tabs
              </button>
              <button
                role="menuitem"
                onClick={() => action(() => onClose(menu.path, "all"))}
              >
                Close all tabs
              </button>
            </>
          )}
          <div role="separator" />
          <button
            role="menuitem"
            disabled={!canReopen}
            onClick={() => action(onReopen)}
          >
            Reopen closed tab
          </button>
        </div>
      )}
    </div>
  );
}
