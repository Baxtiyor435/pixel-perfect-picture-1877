import { useEffect, useRef, useState } from "react";

/** localStorage-backed state. Loads after hydration to avoid SSR mismatch. */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("iw:" + key);
      if (raw != null) setValue(JSON.parse(raw));
    } catch {
      /* ignore corrupt entry */
    }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem("iw:" + key, JSON.stringify(value));
    } catch {
      /* quota exceeded: large images */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem("iw:" + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
export function writeStore(key: string, v: unknown) {
  try {
    localStorage.setItem("iw:" + key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export type Task = 1 | 2;
export type Theme = "paper" | "night" | "mono" | "exam";
export type Lang = "uz" | "en";

export interface Settings {
  theme: Theme;
  lang: Lang;
  fontSize: number;
  grid: boolean;
  gridSize: number;
  t1: number;
  t2: number;
}
export const defaultSettings: Settings = {
  theme: "paper",
  lang: "uz",
  fontSize: 18,
  grid: true,
  gridSize: 24,
  t1: 20,
  t2: 40,
};

export const HL_COLORS = ["yellow", "green", "blue", "pink", "orange"] as const;
export type HlColor = (typeof HL_COLORS)[number];

const dict = {
  uz: {
    answer: "Javob",
    question: "Savol",
    structure: "Tuzilma",
    plan: "Reja",
    board: "Doska",
    words: "so‘z",
    paragraphs: "xatboshi",
    target: "maqsad",
    answerPh: "Javobingizni shu yerda yozing…",
    questionPh: "Savolni yozing yoki joylang. Diagramma rasmini Cmd+V bilan joylashtiring yoki shu yerga tashlang.",
    dropImage: "Rasm qo‘shish",
    library: "Savollar kutubxonasi",
    save: "Saqlash",
    search: "Qidirish…",
    empty: "Hali saqlangan savol yo‘q",
    settings: "Sozlamalar",
    shortcuts: "Tezkor tugmalar",
    theme: "Mavzu",
    language: "Til",
    fontSize: "Shrift o‘lchami",
    grid: "Katak fon",
    gridSize: "Katak o‘lchami",
    timers: "Taymer (daqiqa)",
    history: "Versiyalar tarixi",
    snapshot: "Hozirgi holatni saqlash",
    restore: "Tiklash",
    export: "Eksport",
    copy: "Matnni nusxalash",
    focus: "Fokus rejimi",
    phrases: "Iboralar banki",
    newQ: "Yangi savol",
    remove: "Olib tashlash",
    clearAll: "Hammasini tozalash",
    confirmClear: "Doskadagi hamma narsa o‘chiriladi. Davom etasizmi?",
    chart: "Diagramma",
    chartMake: "Diagramma yaratish",
    chartHelp: "Har qatorda: nom, qiymat (yoki CSV joylang)",
    title: "Sarlavha",
    draw: "Chizish",
    highlights: "Belgilashlar",
    noHighlights: "Belgilash yo‘q. Matnni tanlang.",
    imageMarker: "Rasm ustida marker",
  },
  en: {
    answer: "Answer",
    question: "Question",
    structure: "Structure",
    plan: "Plan",
    board: "Board",
    words: "words",
    paragraphs: "paragraphs",
    target: "target",
    answerPh: "Start writing your answer…",
    questionPh: "Type or paste the question. Paste a chart with Cmd+V or drop an image here.",
    dropImage: "Add image",
    library: "Question library",
    save: "Save",
    search: "Search…",
    empty: "No saved questions yet",
    settings: "Settings",
    shortcuts: "Shortcuts",
    theme: "Theme",
    language: "Language",
    fontSize: "Font size",
    grid: "Grid background",
    gridSize: "Grid size",
    timers: "Timers (min)",
    history: "Version history",
    snapshot: "Save snapshot now",
    restore: "Restore",
    export: "Export",
    copy: "Copy as plain text",
    focus: "Focus mode",
    phrases: "Phrase bank",
    newQ: "New question",
    remove: "Remove",
    clearAll: "Clear all",
    confirmClear: "Everything on the board will be erased. Continue?",
    chart: "Chart",
    chartMake: "Create chart",
    chartHelp: "One row per line: label, value (or paste CSV)",
    title: "Title",
    draw: "Draw",
    highlights: "Highlights",
    noHighlights: "No highlights. Select some text.",
    imageMarker: "Marker on image",
  },
};
export type Dict = (typeof dict)["en"];
export const t = (lang: Lang): Dict => dict[lang];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function countWords(text: string) {
  const m = text.trim().match(/[A-Za-z0-9\u00C0-\u024F'’-]+/g);
  return m ? m.length : 0;
}
