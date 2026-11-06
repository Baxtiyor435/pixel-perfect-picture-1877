import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, BarChart3, Circle, Download, Eraser, Highlighter, Minus, MousePointer2, PenLine,
  Redo2, Square, Trash2, Type, Undo2, X,
} from "lucide-react";
import { uid, usePersisted, type Dict } from "@/lib/iw-store";
import { drawChart, PALETTES, type ChartSpec, type ChartType } from "./charts";

type Pt = [number, number];
type Tool = "select" | "pen" | "hl" | "eraser" | "line" | "arrow" | "rect" | "circle" | "text";
type Item =
  | { id: string; kind: "stroke"; tool: "pen" | "hl" | "eraser"; color: string; size: number; pts: Pt[] }
  | { id: string; kind: "shape"; shape: "line" | "arrow" | "rect" | "circle"; color: string; size: number; a: Pt; b: Pt }
  | { id: string; kind: "text"; x: number; y: number; text: string; color: string; size: number }
  | { id: string; kind: "chart"; x: number; y: number; w: number; h: number; spec: ChartSpec };

const INK_COLORS = ["ink", "#d23c3c", "#2f6fdc", "#2e9a62", "#8a4fd0"];
const HL_COLORS = ["#ffdf3d", "#82de7e", "#86c4ff", "#ff97cb", "#ffb45e"];

const resolve = (c: string, ink: string) => (c === "ink" ? ink : c);

function drawItem(ctx: CanvasRenderingContext2D, it: Item, ink: string, muted: string) {
  ctx.save();
  if (it.kind === "stroke") {
    ctx.globalCompositeOperation = it.tool === "eraser" ? "destination-out" : it.tool === "hl" ? "multiply" : "source-over";
    ctx.globalAlpha = it.tool === "hl" ? 0.5 : 1;
    ctx.strokeStyle = it.tool === "eraser" ? "#000" : resolve(it.color, ink);
    ctx.lineWidth = it.size;
    ctx.lineCap = ctx.lineJoin = "round";
    const p = it.pts;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      const my = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
    }
    if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
  } else if (it.kind === "shape") {
    ctx.strokeStyle = resolve(it.color, ink);
    ctx.lineWidth = it.size;
    ctx.lineCap = ctx.lineJoin = "round";
    const [ax, ay] = it.a;
    const [bx, by] = it.b;
    ctx.beginPath();
    if (it.shape === "rect") ctx.rect(ax, ay, bx - ax, by - ay);
    else if (it.shape === "circle") ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2, Math.abs(by - ay) / 2, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      if (it.shape === "arrow") {
        const ang = Math.atan2(by - ay, bx - ax);
        const L = 10 + it.size * 2;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - L * Math.cos(ang - 0.45), by - L * Math.sin(ang - 0.45));
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - L * Math.cos(ang + 0.45), by - L * Math.sin(ang + 0.45));
      }
    }
    ctx.stroke();
  } else if (it.kind === "text") {
    ctx.fillStyle = resolve(it.color, ink);
    ctx.font = `500 ${it.size}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(it.text, it.x, it.y);
  } else if (it.kind === "chart") {
    drawChart(ctx, it.spec, it.x, it.y, it.w, it.h, ink, muted);
  }
  ctx.restore();
}

function hit(it: Item, x: number, y: number, ctx: CanvasRenderingContext2D) {
  if (it.kind === "chart") return x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h;
  if (it.kind === "text") {
    ctx.font = `500 ${it.size}px system-ui`;
    const w = ctx.measureText(it.text).width;
    return x >= it.x && x <= it.x + w && y >= it.y && y <= it.y + it.size * 1.2;
  }
  return false;
}

const DEFAULT_SPEC: ChartSpec = {
  type: "bar",
  title: "Internet users by country (millions)",
  xLabel: "Country",
  yLabel: "Millions",
  data: "Country, 2010, 2020\nUK, 45, 62\nFrance, 42, 58\nSpain, 28, 41\nItaly, 30, 48",
  palette: 0,
};

export function Board({ task, d }: { task: number; d: Dict }) {
  const [items, setItems] = usePersisted<Item[]>(`board:${task}`, []);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("ink");
  const [hlColor, setHlColor] = useState(HL_COLORS[0]);
  const [size, setSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(24);
  const [chartDialog, setChartDialog] = useState<{ id?: string; spec: ChartSpec } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Item | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const past = useRef<Item[][]>([]);
  const future = useRef<Item[][]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const commit = useCallback(
    (next: Item[]) => {
      past.current.push(itemsRef.current);
      if (past.current.length > 200) past.current.shift();
      future.current = [];
      setItems(next);
    },
    [setItems],
  );
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(itemsRef.current);
    setItems(prev);
  }, [setItems]);
  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt) return;
    past.current.push(itemsRef.current);
    setItems(nxt);
  }, [setItems]);

  useEffect(() => {
    past.current = [];
    future.current = [];
  }, [task]);

  const colors = () => {
    const cs = getComputedStyle(wrap.current!);
    return { ink: cs.getPropertyValue("--ink").trim() || "#222", muted: cs.getPropertyValue("--muted-foreground").trim() || "#888" };
  };

  const render = useCallback(() => {
    const c = canvas.current;
    if (!c || !wrap.current) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const { ink, muted } = colors();
    for (const it of itemsRef.current) drawItem(ctx, it, ink, muted);
    if (draft.current) drawItem(ctx, draft.current, ink, muted);
    if (selected) {
      const it = itemsRef.current.find((i) => i.id === selected);
      if (it?.kind === "chart") {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = muted;
        ctx.strokeRect(it.x - 4, it.y - 4, it.w + 8, it.h + 8);
      }
    }
  }, [selected]);

  useEffect(() => {
    render();
  }, [items, render]);

  // Keep canvas sized to its container at device resolution; re-render on theme change too.
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.current!.width = el.clientWidth * dpr;
      canvas.current!.height = el.clientHeight * dpr;
      render();
    });
    ro.observe(el);
    const mo = new MutationObserver(render);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [render]);

  const pt = (e: React.PointerEvent): Pt => {
    const r = wrap.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || textInput) return;
    wrap.current!.focus();
    const p = pt(e);
    if (tool === "select") {
      const ctx = canvas.current!.getContext("2d")!;
      const it = [...itemsRef.current].reverse().find((i) => hit(i, p[0], p[1], ctx));
      setSelected(it?.id ?? null);
      if (it && (it.kind === "chart" || it.kind === "text")) {
        drag.current = { id: it.id, dx: p[0] - it.x, dy: p[1] - it.y, moved: false };
        past.current.push(itemsRef.current);
      }
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "text") {
      setTextInput({ x: p[0], y: p[1] - 10, value: "" });
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === "pen" || tool === "hl" || tool === "eraser") {
      draft.current = {
        id: uid(), kind: "stroke", tool,
        color: tool === "hl" ? hlColor : color,
        size: tool === "eraser" ? eraserSize : tool === "hl" ? Math.max(14, size * 5) : size,
        pts: [p],
      };
    } else {
      draft.current = { id: uid(), kind: "shape", shape: tool, color, size, a: p, b: p };
    }
    render();
  };

  const onMove = (e: React.PointerEvent) => {
    const p = pt(e);
    setCursor(p);
    if (drag.current) {
      const { id, dx, dy } = drag.current;
      drag.current.moved = true;
      setItems((arr) => arr.map((i) => (i.id === id && (i.kind === "chart" || i.kind === "text") ? { ...i, x: p[0] - dx, y: p[1] - dy } : i)));
      return;
    }
    const dr = draft.current;
    if (!dr) return;
    if (dr.kind === "stroke") dr.pts.push(p);
    else if (dr.kind === "shape") {
      let b = p;
      if (e.shiftKey && (dr.shape === "rect" || dr.shape === "circle")) {
        const s = Math.max(Math.abs(p[0] - dr.a[0]), Math.abs(p[1] - dr.a[1]));
        b = [dr.a[0] + Math.sign(p[0] - dr.a[0]) * s, dr.a[1] + Math.sign(p[1] - dr.a[1]) * s];
      }
      dr.b = b;
    }
    render();
  };

  const onUp = () => {
    if (drag.current) {
      if (!drag.current.moved) past.current.pop();
      else future.current = [];
      drag.current = null;
      return;
    }
    if (draft.current) {
      const it = draft.current;
      draft.current = null;
      commit([...itemsRef.current, it]);
    }
  };

  // Board shortcuts (only while the board has focus)
  const onKey = (e: React.KeyboardEvent) => {
    if (textInput) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.key === "Backspace" || e.key === "Delete") && selected) {
      commit(itemsRef.current.filter((i) => i.id !== selected));
      setSelected(null);
      return;
    }
    if (mod || e.altKey) return;
    const map: Record<string, Tool> = { v: "select", p: "pen", h: "hl", e: "eraser", l: "line", a: "arrow", r: "rect", o: "circle", t: "text" };
    const t = map[e.key.toLowerCase()];
    if (t) setTool(t);
    if (e.key === "[") tool === "eraser" ? setEraserSize((s) => Math.max(6, s - 4)) : setSize((s) => Math.max(1, s - 1));
    if (e.key === "]") tool === "eraser" ? setEraserSize((s) => Math.min(120, s + 4)) : setSize((s) => Math.min(24, s + 1));
  };

  const exportPng = () => {
    const c = canvas.current!;
    const out = document.createElement("canvas");
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext("2d")!;
    const cs = getComputedStyle(wrap.current!);
    ctx.fillStyle = cs.backgroundColor;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c, 0, 0);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `ielts-board-task${task}.png`;
    a.click();
  };

  const saveChart = (spec: ChartSpec, id?: string) => {
    if (id) commit(itemsRef.current.map((i) => (i.id === id && i.kind === "chart" ? { ...i, spec } : i)));
    else {
      const el = wrap.current!;
      const w = Math.min(520, el.clientWidth - 48);
      const h = Math.min(300, el.clientHeight - 48);
      const nid = uid();
      commit([...itemsRef.current, { id: nid, kind: "chart", x: 24, y: 24, w, h, spec }]);
      setSelected(nid);
    }
    setChartDialog(null);
  };

  const selChart = items.find((i) => i.id === selected && i.kind === "chart") as Extract<Item, { kind: "chart" }> | undefined;
  const lastChart = selChart ?? ([...items].reverse().find((i) => i.kind === "chart") as typeof selChart);

  const ToolBtn = ({ id, icon: Icon, label, k }: { id: Tool; icon: typeof PenLine; label: string; k: string }) => (
    <button className="tb-btn h-7 min-w-7 px-1.5" aria-pressed={tool === id} title={`${label} (${k})`} aria-label={label} onClick={() => setTool(id)}>
      <Icon size={15} />
    </button>
  );

  const curSize = tool === "eraser" ? eraserSize : tool === "hl" ? Math.max(14, size * 5) : size;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-chrome px-2 py-1">
        <ToolBtn id="select" icon={MousePointer2} label="Select / move" k="V" />
        <ToolBtn id="pen" icon={PenLine} label="Pen" k="P" />
        <ToolBtn id="hl" icon={Highlighter} label="Highlighter" k="H" />
        <ToolBtn id="eraser" icon={Eraser} label="Eraser" k="E" />
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn id="line" icon={Minus} label="Line" k="L" />
        <ToolBtn id="arrow" icon={ArrowUpRight} label="Arrow" k="A" />
        <ToolBtn id="rect" icon={Square} label="Rectangle" k="R" />
        <ToolBtn id="circle" icon={Circle} label="Circle" k="O" />
        <ToolBtn id="text" icon={Type} label="Text label" k="T" />
        <span className="mx-1 h-4 w-px bg-border" />
        <div className="flex items-center gap-1">
          {(tool === "hl" ? HL_COLORS : INK_COLORS).map((c) => {
            const active = tool === "hl" ? hlColor === c : color === c;
            return (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => (tool === "hl" ? setHlColor(c) : setColor(c))}
                className={`h-4 w-4 rounded-full ring-offset-1 ring-offset-chrome ${active ? "ring-2 ring-ring" : "ring-1 ring-border"} ${c === "ink" ? "bg-foreground" : ""}`}
                style={c === "ink" ? undefined : { background: c }}
              />
            );
          })}
          {tool !== "hl" && (
            <input type="color" aria-label="Custom color" className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" value={color === "ink" ? "#1f2f57" : color} onChange={(e) => setColor(e.target.value)} />
          )}
        </div>
        <label className="ml-1 flex items-center gap-1 text-muted-foreground" title="Size ([ / ])">
          <input
            type="range"
            min={tool === "eraser" ? 6 : 1}
            max={tool === "eraser" ? 120 : 24}
            value={tool === "eraser" ? eraserSize : size}
            onChange={(e) => (tool === "eraser" ? setEraserSize(+e.target.value) : setSize(+e.target.value))}
            className="w-16 accent-primary"
            aria-label="Stroke size"
          />
          <span className="w-6 tabular-nums text-[11px]">{tool === "eraser" ? eraserSize : size}</span>
        </label>
        <div className="ml-auto flex items-center gap-0.5">
          <button className="tb-btn h-7 min-w-7 px-1.5" title="Undo (⌘Z)" aria-label="Undo" onClick={undo}><Undo2 size={15} /></button>
          <button className="tb-btn h-7 min-w-7 px-1.5" title="Redo (⇧⌘Z)" aria-label="Redo" onClick={redo}><Redo2 size={15} /></button>
          <button className="tb-btn h-7 px-2" onClick={() => setChartDialog({ spec: DEFAULT_SPEC })}><BarChart3 size={15} />{d.chart}</button>
          <button className="tb-btn h-7 min-w-7 px-1.5" title="Export PNG" aria-label="Export PNG" onClick={exportPng}><Download size={15} /></button>
          <button
            className="tb-btn h-7 min-w-7 px-1.5 hover:text-destructive"
            title={d.clearAll}
            aria-label={d.clearAll}
            onClick={() => items.length && window.confirm(d.confirmClear) && commit([])}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {lastChart && (
        <div className="flex items-center gap-1 border-b border-border bg-surface px-2 py-1 text-[12px]">
          <span className="mr-1 truncate text-muted-foreground">{lastChart.spec.title || d.chart}</span>
          {(["bar", "line", "pie", "stacked", "table"] as ChartType[]).map((ty) => (
            <button key={ty} className="chip" aria-pressed={lastChart.spec.type === ty} onClick={() => commit(items.map((i) => (i.id === lastChart.id && i.kind === "chart" ? { ...i, spec: { ...i.spec, type: ty } } : i)))}>
              {ty === "stacked" ? "Stacked" : ty[0].toUpperCase() + ty.slice(1)}
            </button>
          ))}
          <button className="btn ml-auto h-6 px-2" onClick={() => setChartDialog({ id: lastChart.id, spec: lastChart.spec })}>Edit</button>
        </div>
      )}

      <div
        ref={wrap}
        tabIndex={0}
        onKeyDown={onKey}
        className="grid-paper relative min-h-0 flex-1 overflow-hidden outline-none"
        style={{ cursor: tool === "select" ? "default" : tool === "text" ? "text" : tool === "eraser" ? "none" : "crosshair", touchAction: "none" }}
        onPointerLeave={() => setCursor(null)}
      >
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {cursor && (tool === "eraser" || tool === "hl") && (
          <div
            className="pointer-events-none absolute rounded-full border-2 border-foreground/60"
            style={{ left: cursor[0] - curSize / 2, top: cursor[1] - curSize / 2, width: curSize, height: curSize, background: tool === "eraser" ? "color-mix(in oklab, var(--background) 60%, transparent)" : undefined }}
          />
        )}
        {textInput && (
          <input
            autoFocus
            className="field absolute h-7 min-w-40"
            style={{ left: textInput.x, top: textInput.y }}
            value={textInput.value}
            placeholder="Label…"
            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && textInput.value.trim()) {
                commit([...items, { id: uid(), kind: "text", x: textInput.x, y: textInput.y + 4, text: textInput.value, color, size: 14 + size }]);
                setTextInput(null);
              }
              if (e.key === "Escape") setTextInput(null);
            }}
            onBlur={() => setTextInput(null)}
          />
        )}
        {!items.length && !draft.current && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-muted-foreground">
            Draw, annotate, or create a chart from your data.
          </p>
        )}
      </div>

      {chartDialog && <ChartDialog d={d} initial={chartDialog.spec} onClose={() => setChartDialog(null)} onSave={(s) => saveChart(s, chartDialog.id)} />}
    </div>
  );
}

function ChartDialog({ initial, onSave, onClose, d }: { initial: ChartSpec; onSave: (s: ChartSpec) => void; onClose: () => void; d: Dict }) {
  const [s, setS] = useState(initial);
  const preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = preview.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = 440 * dpr;
    c.height = 240 * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(c);
    drawChart(ctx, s, 8, 8, 424, 224, cs.getPropertyValue("--ink").trim(), cs.getPropertyValue("--muted-foreground").trim());
  }, [s]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pop w-[760px] max-w-[95vw] p-4" role="dialog" aria-label={d.chartMake} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="mb-3 flex items-center">
          <h2 className="text-[15px] font-semibold">{d.chartMake}</h2>
          <button className="tb-btn ml-auto" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-[1fr_440px] gap-4">
          <div className="flex flex-col gap-2">
            <input className="field" placeholder={d.title} value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} autoFocus />
            <div className="flex gap-2">
              <input className="field w-0 flex-1" placeholder="X axis" value={s.xLabel} onChange={(e) => setS({ ...s, xLabel: e.target.value })} />
              <input className="field w-0 flex-1" placeholder="Y axis" value={s.yLabel} onChange={(e) => setS({ ...s, yLabel: e.target.value })} />
            </div>
            <label className="text-[12px] text-muted-foreground">{d.chartHelp}</label>
            <textarea className="field h-36 resize-none py-1.5 font-mono text-[12px] leading-5" value={s.data} onChange={(e) => setS({ ...s, data: e.target.value })} />
            <div className="flex items-center gap-2">
              {PALETTES.map((p, i) => (
                <button key={i} onClick={() => setS({ ...s, palette: i })} aria-pressed={s.palette === i} aria-label={`Palette ${i + 1}`} className={`flex overflow-hidden rounded-sm ${s.palette === i ? "ring-2 ring-ring" : "ring-1 ring-border"}`}>
                  {p.slice(0, 4).map((c) => <span key={c} className="h-4 w-4" style={{ background: c }} />)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="seg mb-2">
              {(["bar", "line", "pie", "stacked", "table"] as ChartType[]).map((ty) => (
                <button key={ty} aria-pressed={s.type === ty} onClick={() => setS({ ...s, type: ty })}>{ty[0].toUpperCase() + ty.slice(1)}</button>
              ))}
            </div>
            <canvas ref={preview} className="grid-paper h-[240px] w-[440px] rounded-md border border-border" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(s)}>{d.chartMake}</button>
        </div>
      </div>
    </div>
  );
}
