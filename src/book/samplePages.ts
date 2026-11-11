import ayahData from "@/content/ayahs.json";
import englishData from "@/content/english.json";
import latinData from "@/content/transliteration.json";
import metaData from "@/content/meta.json";

export interface SurahMeta {
  n: number;
  nameLatin: string;
  meaning: string;
  nameArabic: string;
  ayahs: number;
  startPage: number;
  startJuz: number;
  revelation: string;
}

export interface JuzMeta {
  n: number;
  surah: number;
  ayah: number;
  page: number;
}

export interface PageSegment {
  surah: number;
  nameLatin: string;
  meaning: string;
  nameArabic: string;
  start: number;
  end: number;
  ayahs: string[];
  transliteration: string[];
  english: string[];
}

export type PageKind = "arabic" | "transliteration";

/** One printed face: the Arabic of a mushaf page, or that page's transliteration. */
export interface BookPage {
  kind: PageKind;
  mushafPage: number;
  segments: PageSegment[];
}

interface MetaFile {
  mushafPages: number;
  surahs: SurahMeta[];
  juz: JuzMeta[];
  pages: Record<string, { surah: number; start: number; end: number }[]>;
}

const meta = metaData as MetaFile;
const arabic = ayahData.surahs as Record<string, string[]>;
const latin = latinData.surahs as Record<string, string[]>;
const english = englishData.surahs as Record<string, string[]>;

export const MUSHAF_PAGES = meta.mushafPages;
export const SURAHS: readonly SurahMeta[] = meta.surahs;
export const JUZ: readonly JuzMeta[] = meta.juz;

export const BASMALA: string = ayahData.basmala;
export const TANZIL_NOTICE: string = ayahData.notice;
export const BASMALA_LATIN: string = latinData.basmala;
export const BASMALA_ENGLISH: string = englishData.basmala;
export const TRANSLITERATION_NOTICE: string = latinData.notice;
export const ENGLISH_NOTICE: string = englishData.notice;

/** A short key to AllahsWord's marks, printed at the foot of each transliteration page. */
export const TRANSLITERATION_KEY = "‘ ‘ayn   ' hamza   q̇ qaf   ḍ dad   ẓ dhal   ġ ghayn   k͜h s͜h t͜h one sound";

function slice(surah: number, start: number, end: number): PageSegment {
  const info = SURAHS[surah - 1];
  if (!info) throw new Error(`Unknown surah ${surah}`);
  const key = String(surah);
  const a = arabic[key];
  const t = latin[key];
  const e = english[key];
  if (!a || !t || !e) throw new Error(`Missing text for surah ${surah}`);
  if (a.length !== t.length || a.length !== e.length) {
    throw new Error(`Surah ${surah} texts are different lengths`);
  }
  if (start < 1 || end > a.length || start > end) throw new Error(`Bad range ${surah}:${start}–${end}`);
  return {
    surah,
    nameLatin: info.nameLatin,
    meaning: info.meaning,
    nameArabic: info.nameArabic,
    start,
    end,
    ayahs: a.slice(start - 1, end),
    transliteration: t.slice(start - 1, end),
    english: e.slice(start - 1, end),
  };
}

function segmentsFor(mushafPage: number): PageSegment[] {
  const rows = meta.pages[String(mushafPage)];
  if (!rows?.length) throw new Error(`No ayahs mapped to mushaf page ${mushafPage}`);
  return rows.map((row) => slice(row.surah, row.start, row.end));
}

/**
 * 604 mushaf pages, each printed twice: Arabic on the odd face (right of the
 * spread) and transliteration on the even face (left). `position` in the store
 * is this mushaf page, so the open spread is always a pair.
 */
export const BOOK_PAGES: readonly BookPage[] = Array.from({ length: MUSHAF_PAGES }, (_, i) => {
  const mushafPage = i + 1;
  const segments = segmentsFor(mushafPage);
  return [
    { kind: "arabic" as const, mushafPage, segments },
    { kind: "transliteration" as const, mushafPage, segments },
  ];
}).flat();

if (BOOK_PAGES.length !== MUSHAF_PAGES * 2) throw new Error("Book is not 604 × 2 faces");

export function juzForPage(page: number): number {
  let n = 1;
  for (const j of JUZ) {
    if (j.page <= page) n = j.n;
  }
  return n;
}

export function showsBasmala(segment: PageSegment): boolean {
  return segment.start === 1 && segment.surah !== 1 && segment.surah !== 9;
}
