export type ChartType = "bar" | "line" | "pie" | "stacked" | "table";
export interface ChartSpec {
  type: ChartType;
  title: string;
  xLabel: string;
  yLabel: string;
  data: string;
  palette: number;
}

export const PALETTES = [
  ["#3b6fd8", "#e0884a", "#3fa58a", "#c25a8f", "#8a79d6", "#c9a23a"],
  ["#1f2f57", "#56688f", "#93a2bf", "#c8d0de", "#3d5285", "#7d8bab"],
  ["#111111", "#555555", "#8a8a8a", "#bdbdbd", "#333333", "#707070"],
];

export interface Parsed {
  series: string[];
  rows: { label: string; values: number[] }[];
}

export function parseData(raw: string): Parsed {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t|;|,(?=\s*-?[\d.])|,/).map((c) => c.trim()));
  let series: string[] = ["Value"];
  if (lines.length && lines[0].slice(1).some((c) => c && Number.isNaN(Number(c)))) {
    series = lines.shift()!.slice(1);
  }
  const rows = lines.map((cells) => ({ label: cells[0] ?? "", values: cells.slice(1).map((c) => Number(c) || 0) }));
  const n = Math.max(1, ...rows.map((r) => r.values.length));
  while (series.length < n) series.push(`Series ${series.length + 1}`);
  series = series.slice(0, n);
  return { series, rows };
}

const nice = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${+v.toFixed(1)}`);

/** Draws a clean, print-like chart into the given box. */
export function drawChart(ctx: CanvasRenderingContext2D, spec: ChartSpec, x: number, y: number, w: number, h: number, ink: string, muted: string) {
  const { series, rows } = parseData(spec.data);
  const pal = PALETTES[spec.palette] ?? PALETTES[0];
  const font = (s: number, wgt = 400) => `${wgt} ${s}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.font = font(14, 600);
  ctx.textAlign = "center";
  if (spec.title) ctx.fillText(spec.title, x + w / 2, y + 12);
  if (!rows.length) {
    ctx.restore();
    return;
  }

  const legend = spec.type === "pie" || (series.length > 1 && spec.type !== "table");
  const legendItems = spec.type === "pie" ? rows.map((r) => r.label) : series;
  const top = y + (spec.title ? 32 : 10);
  const right = x + w - (legend ? 110 : 12);

  const drawLegend = () => {
    if (!legend) return;
    ctx.font = font(11);
    ctx.textAlign = "left";
    legendItems.forEach((s, i) => {
      const ly = top + 6 + i * 18;
      ctx.fillStyle = pal[i % pal.length];
      ctx.fillRect(right + 14, ly - 5, 10, 10);
      ctx.fillStyle = ink;
      ctx.fillText(s.slice(0, 14), right + 30, ly);
    });
  };

  if (spec.type === "table") {
    const cols = [spec.xLabel || "", ...series];
    const ch = Math.min(28, (y + h - top) / (rows.length + 1));
    const cw = (x + w - x) / cols.length;
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.font = font(12, 600);
    [cols, ...rows.map((r) => [r.label, ...r.values.map(fmt)])].forEach((r, ri) => {
      r.forEach((c, ci) => {
        const cx = x + ci * cw;
        const cy = top + ri * ch;
        ctx.strokeRect(Math.round(cx) + 0.5, Math.round(cy) + 0.5, cw, ch);
        ctx.fillStyle = ink;
        ctx.textAlign = ci === 0 ? "left" : "right";
        ctx.fillText(String(c), ci === 0 ? cx + 8 : cx + cw - 8, cy + ch / 2);
      });
      ctx.font = font(12);
    });
    ctx.restore();
    return;
  }

  if (spec.type === "pie") {
    const vals = rows.map((r) => Math.max(0, r.values[0] ?? 0));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(right - x, y + h - top) / 2 - 8;
    const cx = x + (right - x) / 2;
    const cy = top + (y + h - top) / 2;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = pal[i % pal.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const mid = (a0 + a1) / 2;
      if (v / total > 0.04) {
        ctx.fillStyle = "#fff";
        ctx.font = font(11, 600);
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round((v / total) * 100)}%`, cx + Math.cos(mid) * r * 0.65, cy + Math.sin(mid) * r * 0.65);
      }
      a0 = a1;
    });
    drawLegend();
    ctx.restore();
    return;
  }

  const left = x + 46;
  const bottom = y + h - (spec.xLabel ? 40 : 26);
  const maxV = nice(
    Math.max(...rows.map((r) => (spec.type === "stacked" ? r.values.reduce((a, b) => a + b, 0) : Math.max(...r.values, 0)))),
  );
  const py = (v: number) => bottom - (v / maxV) * (bottom - top);

  // gridlines + y ticks
  ctx.font = font(11);
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const v = (maxV / 5) * i;
    const yy = Math.round(py(v)) + 0.5;
    ctx.strokeStyle = i === 0 ? ink : muted;
    ctx.globalAlpha = i === 0 ? 1 : 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, yy);
    ctx.lineTo(right, yy);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = muted;
    ctx.fillText(fmt(v), left - 6, yy);
  }
  const slot = (right - left) / rows.length;
  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  rows.forEach((r, i) => ctx.fillText(r.label.slice(0, 12), left + slot * (i + 0.5), bottom + 12));

  if (spec.type === "bar") {
    const bw = Math.min(36, (slot * 0.72) / series.length);
    rows.forEach((r, i) => {
      const start = left + slot * (i + 0.5) - (bw * series.length) / 2;
      r.values.forEach((v, s) => {
        ctx.fillStyle = pal[s % pal.length];
        ctx.fillRect(start + s * bw, py(v), bw - 2, bottom - py(v));
      });
    });
  } else if (spec.type === "stacked") {
    const bw = Math.min(48, slot * 0.6);
    rows.forEach((r, i) => {
      let acc = 0;
      r.values.forEach((v, s) => {
        ctx.fillStyle = pal[s % pal.length];
        ctx.fillRect(left + slot * (i + 0.5) - bw / 2, py(acc + v), bw, py(acc) - py(acc + v));
        acc += v;
      });
    });
  } else if (spec.type === "line") {
    series.forEach((_, s) => {
      ctx.strokeStyle = ctx.fillStyle = pal[s % pal.length];
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      rows.forEach((r, i) => {
        const px = left + slot * (i + 0.5);
        i ? ctx.lineTo(px, py(r.values[s] ?? 0)) : ctx.moveTo(px, py(r.values[s] ?? 0));
      });
      ctx.stroke();
      rows.forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(left + slot * (i + 0.5), py(r.values[s] ?? 0), 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  ctx.fillStyle = muted;
  ctx.font = font(11, 500);
  if (spec.xLabel) ctx.fillText(spec.xLabel, (left + right) / 2, bottom + 30);
  if (spec.yLabel) {
    ctx.save();
    ctx.translate(x + 8, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(spec.yLabel, 0, 0);
    ctx.restore();
  }
  drawLegend();
  ctx.restore();
}
