"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOOK_PAGES, JUZ, MUSHAF_PAGES, SURAHS, juzForPage, type SurahMeta } from "@/book/samplePages";
import { useReader } from "@/state/reader";
import styles from "./Reader.module.css";

function matches(surah: SurahMeta, q: string): boolean {
  if (!q) return true;
  if (String(surah.n) === q) return true;
  if (surah.nameLatin.toLowerCase().includes(q)) return true;
  if (surah.meaning.toLowerCase().includes(q)) return true;
  if (surah.nameArabic.includes(q)) return true;
  return false;
}

function pageQuery(q: string): number | null {
  const m = /^(?:p|page)\s*(\d{1,3})$/.exec(q);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= MUSHAF_PAGES ? n : null;
  }
  if (/^\d{1,3}$/.test(q)) {
    const n = Number(q);
    if (n > 114 && n <= MUSHAF_PAGES) return n;
  }
  return null;
}

function juzQuery(q: string): number | null {
  const m = /^juz\s*(\d{1,2})$/.exec(q);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 30 ? n : null;
}

export function Index({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const position = useReader((s) => s.position);
  const goToPosition = useReader((s) => s.goToPosition);
  const goToSurah = useReader((s) => s.goToSurah);
  const goToJuz = useReader((s) => s.goToJuz);

  const q = query.trim().toLowerCase();
  const page = pageQuery(q);
  const juz = juzQuery(q);
  const surahs = useMemo(() => SURAHS.filter((s) => matches(s, q)), [q]);
  const openSurahs = new Set(BOOK_PAGES[2 * position - 1]?.segments.map((seg) => seg.surah));
  const openJuz = juzForPage(position);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const id = window.setTimeout(() => input.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const jump = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div className={styles.index} role="dialog" aria-modal="true" aria-labelledby="index-title">
      <div className={styles.indexSheet}>
        <header className={styles.indexHead}>
          <div>
            <h2 id="index-title">Go to</h2>
            <p>114 surahs · 30 juz · {MUSHAF_PAGES} pages</p>
          </div>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Close
          </button>
        </header>

        <input
          ref={input}
          className={styles.indexSearch}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Surah, meaning, page 2, juz…"
          aria-label="Search the Quran"
        />

        <div className={styles.juz} role="list" aria-label="Juz">
          {JUZ.map((j) => (
            <button
              key={j.n}
              type="button"
              role="listitem"
              className={styles.juzChip}
              aria-label={`Juz ${j.n}`}
              aria-current={j.n === openJuz ? "true" : undefined}
              onClick={() => jump(() => goToJuz(j.n))}
            >
              {j.n}
            </button>
          ))}
        </div>

        {page != null && (
          <button type="button" className={styles.pageJump} onClick={() => jump(() => goToPosition(page))}>
            Open mushaf page {page}
          </button>
        )}
        {juz != null && (
          <button type="button" className={styles.pageJump} onClick={() => jump(() => goToJuz(juz))}>
            Open juz {juz}
          </button>
        )}

        <ol className={styles.surahs}>
          {surahs.map((s) => (
            <li key={s.n}>
              <button
                type="button"
                className={styles.surah}
                aria-current={openSurahs.has(s.n) ? "true" : undefined}
                onClick={() => jump(() => goToSurah(s.n))}
              >
                <span className={styles.surahN}>{s.n}</span>
                <span className={styles.surahName}>
                  {s.nameLatin}
                  <em>{s.meaning}</em>
                </span>
                <span className={styles.surahPage}>p. {s.startPage}</span>
              </button>
            </li>
          ))}
        </ol>
        {surahs.length === 0 && page == null && juz == null && <p className={styles.indexEmpty}>Nothing matches.</p>}
      </div>
    </div>
  );
}
