import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface RichEditorHandle {
  el: HTMLDivElement | null;
  insertText: (s: string) => void;
}

interface Props {
  html: string;
  onChange: (html: string) => void;
  placeholder: string;
  className?: string;
  onPasteCapture?: (e: React.ClipboardEvent) => boolean | void;
  label: string;
}

/** Uncontrolled contentEditable that only rewrites the DOM when the stored HTML changes from outside. */
export const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor(
  { html, onChange, placeholder, className, onPasteCapture, label },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const lastRange = useRef<Range | null>(null);

  useEffect(() => {
    if (el.current && el.current.innerHTML !== html) el.current.innerHTML = html;
    el.current?.setAttribute("data-empty", String(!el.current.textContent));
  }, [html]);

  useEffect(() => {
    const track = () => {
      const s = window.getSelection();
      if (s && s.rangeCount && el.current?.contains(s.anchorNode)) lastRange.current = s.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", track);
    return () => document.removeEventListener("selectionchange", track);
  }, []);

  useImperativeHandle(ref, () => ({
    get el() {
      return el.current;
    },
    insertText(s: string) {
      const node = el.current;
      if (!node) return;
      node.focus();
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      if (lastRange.current && node.contains(lastRange.current.startContainer)) sel.addRange(lastRange.current);
      else {
        const r = document.createRange();
        r.selectNodeContents(node);
        r.collapse(false);
        sel.addRange(r);
      }
      document.execCommand("insertText", false, s);
    },
  }));

  return (
    <div
      ref={el}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-hl-root
      data-placeholder={placeholder}
      className={className}
      onInput={(e) => {
        const t = e.currentTarget;
        t.setAttribute("data-empty", String(!t.textContent));
        onChange(t.innerHTML);
      }}
      onPaste={(e) => {
        if (onPasteCapture?.(e)) return;
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    />
  );
});
