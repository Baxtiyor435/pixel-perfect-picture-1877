import type { HlColor } from "@/lib/iw-store";

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function selectionIn(root: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return null;
  return r;
}

const notify = (root: HTMLElement) => root.dispatchEvent(new Event("input", { bubbles: true }));

/** Wraps the current selection in a marker-style <mark>. Works across element boundaries. */
export function applyHighlight(root: HTMLElement, color: HlColor) {
  const r = selectionIn(root);
  if (!r) return false;
  const frag = r.extractContents();
  frag.querySelectorAll("mark.hl").forEach(unwrap);
  const mark = document.createElement("mark");
  mark.className = `hl hl-${color}`;
  mark.appendChild(frag);
  r.insertNode(mark);
  // Drop empty marks left behind by extraction
  root.querySelectorAll("mark.hl").forEach((m) => {
    if (!m.textContent) m.remove();
  });
  root.normalize();
  window.getSelection()?.removeAllRanges();
  notify(root);
  return true;
}

/** Removes any highlight that intersects the selection. */
export function removeHighlight(root: HTMLElement) {
  const r = selectionIn(root);
  if (!r) return false;
  root.querySelectorAll("mark.hl").forEach((m) => {
    if (r.intersectsNode(m)) unwrap(m);
  });
  root.normalize();
  notify(root);
  return true;
}

export function removeMark(root: HTMLElement, m: Element) {
  unwrap(m);
  root.normalize();
  notify(root);
}

export function findHlRoot(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  return (el?.closest("[data-hl-root]") as HTMLElement) ?? null;
}
