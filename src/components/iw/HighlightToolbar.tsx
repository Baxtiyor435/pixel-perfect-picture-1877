import { useEffect, useState } from "react";
import { Eraser } from "lucide-react";
import { HL_COLORS } from "@/lib/iw-store";
import { applyHighlight, findHlRoot, removeHighlight, removeMark } from "./highlight";

/** Floating marker toolbar shown above any text selection inside a [data-hl-root]. */
export function HighlightToolbar() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const root = findHlRoot();
      if (!root) return setPos(null);
      const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
      if (!rect.width) return setPos(null);
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const n = Number(e.code.replace("Digit", ""));
      if (Number.isNaN(n) || n > 5) return;
      const root = findHlRoot();
      if (!root) return;
      e.preventDefault();
      if (n === 0) removeHighlight(root);
      else applyHighlight(root, HL_COLORS[n - 1]);
      setPos(null);
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!pos) return null;
  const act = (fn: (r: HTMLElement) => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    const root = findHlRoot();
    if (root) fn(root);
    setPos(null);
  };
  return (
    <div
      className="pop fixed z-50 flex items-center gap-1 p-1"
      style={{ left: pos.x, top: pos.y - 8, transform: "translate(-50%, -100%)" }}
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label="Highlight"
    >
      {HL_COLORS.map((c, i) => (
        <button
          key={c}
          title={`${c} (⌥${i + 1})`}
          aria-label={`Highlight ${c}`}
          onMouseDown={act((r) => applyHighlight(r, c))}
          className={`sw-${c} h-6 w-6 rounded-[12px_6px_12px_6px] ring-1 ring-border transition-transform hover:scale-110`}
        />
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      <button title="Remove (⌥0)" aria-label="Remove highlight" onMouseDown={act(removeHighlight)} className="tb-btn h-6 min-w-6 px-1">
        <Eraser size={14} />
      </button>
    </div>
  );
}

/** Lists highlights inside a root element so they can be reviewed and removed. */
export function HighlightList({ root, emptyText }: { root: HTMLElement | null; emptyText: string }) {
  const [, force] = useState(0);
  const marks = root ? Array.from(root.querySelectorAll("mark.hl")) : [];
  if (!marks.length) return <p className="p-3 text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="max-h-72 overflow-auto p-1">
      {marks.map((m, i) => {
        const color = (m.className.match(/hl-(\w+)/) || [])[1];
        return (
          <li key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary">
            <span className={`sw-${color} h-3 w-3 flex-none rounded-full`} />
            <button className="flex-1 truncate text-left" onClick={() => m.scrollIntoView({ block: "center", behavior: "smooth" })}>
              {m.textContent}
            </button>
            <button
              className="tb-btn h-6 min-w-6 px-1"
              aria-label="Remove"
              onClick={() => {
                removeMark(root!, m);
                force((x) => x + 1);
              }}
            >
              <Eraser size={13} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
