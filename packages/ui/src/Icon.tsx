/** One consistent, tree-shaken icon vocabulary. Labels belong to the controls. */
import type { JSX } from "react";
import { Play, Square, RotateCcw, History, Upload, Download, Command, Terminal, PanelRightClose, PanelRightOpen, ArrowRight, ArrowUpRight, Boxes, ChartNoAxesCombined, Check, ChevronDown, Code2, Compass, Cpu, FileCode2, Folder, GitBranch, Info, Layers3, LockKeyhole, Moon, PanelLeftClose, PanelLeftOpen, Plus, ShieldCheck, SlidersHorizontal, Sun, TriangleAlert, X } from "lucide-react";
const icons = { play: Play, stop: Square, reset: RotateCcw, history: History, upload: Upload, download: Download, command: Command, terminal: Terminal, rightClose: PanelRightClose, rightOpen: PanelRightOpen, arrow: ArrowRight, external: ArrowUpRight, memory: Boxes, chart: ChartNoAxesCombined, check: Check, down: ChevronDown, code: Code2, explore: Compass, cpu: Cpu, file: FileCode2, folder: Folder, branch: GitBranch, info: Info, layers: Layers3, lock: LockKeyhole, moon: Moon, collapse: PanelLeftClose, expand: PanelLeftOpen, plus: Plus, validate: ShieldCheck, settings: SlidersHorizontal, sun: Sun, warning: TriangleAlert, close: X } as const;
export type IconName = keyof typeof icons;
export function Icon({ name, size = 18 }: { readonly name: IconName; readonly size?: number }): JSX.Element {
  const Component = icons[name];
  return <Component size={size} strokeWidth={1.65} aria-hidden="true" focusable="false" />;
}
