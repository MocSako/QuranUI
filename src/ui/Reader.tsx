"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { canStep, visiblePages } from "@/book/leaves";
import { BASMALA, BASMALA_ENGLISH, BOOK_PAGES, MUSHAF_PAGES, juzForPage, showsBasmala } from "@/book/samplePages";
import { useReader } from "@/state/reader";
import { Index } from "./Index";
import styles from "./Reader.module.css";

const BookScene = dynamic(() => import("@/scene/BookScene"), { ssr: false });

const BAR_IDLE_MS = 4000;

function Mark() {
  return (
    <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 21 L20 7 M20 21 L4 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M2.5 7.5 L12 10 L21.5 7.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

export function Reader() {
  const leaves = useReader((s) => s.leaves);
  const position = useReader((s) => s.position);
  const focus = useReader((s) => s.focus);
  const barVisible = useReader((s) => s.barVisible);
  const requestTurn = useReader((s) => s.requestTurn);
  const barRef = useRef<HTMLElement>(null);
  const [showEnglish, setShowEnglish] = useState(true);
  const [indexOpen, setIndexOpen] = useState(false);

  const bookPages = visiblePages(leaves, position).map((n) => BOOK_PAGES[n - 1]);
  const arabic = bookPages.find((p) => p.kind === "arabic") ?? bookPages[0];
  const segments = arabic?.segments ?? [];
  const names = [...new Set(segments.map((s) => s.nameLatin))];
  const title = names.join(" · ");
  const first = segments[0];
  const juz = juzForPage(position);
  const meta = first
    ? `${first.meaning} · page ${position} of ${MUSHAF_PAGES} · juz ${juz}`
    : "";
  const canNext = canStep(leaves, position, focus, 1);
  const canPrev = canStep(leaves, position, focus, -1);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => useReader.getState().setReducedMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape") {
        if (indexOpen) setIndexOpen(false);
        else useReader.getState().clearFocus();
        e.preventDefault();
        return;
      }
      if (!typing && (e.key === "/" || e.key === "g" || e.key === "G")) {
        setIndexOpen(true);
        e.preventDefault();
        return;
      }
      if (indexOpen || typing) return;
      // A right-bound book: the next page lies to the left.
      if (e.key === "ArrowLeft" || e.key === "PageDown") requestTurn(1);
      else if (e.key === "ArrowRight" || e.key === "PageUp") requestTurn(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestTurn, indexOpen]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.clientY < 96) useReader.getState().showBar();
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (!barVisible || indexOpen) return;
    const id = window.setTimeout(() => {
      if (barRef.current?.matches(":hover, :focus-within")) return;
      useReader.getState().hideBar();
    }, BAR_IDLE_MS);
    return () => window.clearTimeout(id);
  }, [barVisible, position, focus, indexOpen]);

  return (
    <main className={styles.reader} data-english={showEnglish || undefined}>
      <div className={styles.stage}>
        <BookScene label={`An open mushaf on a wooden rehal, showing ${title || "the Quran"}`} />
      </div>

      <header ref={barRef} className={styles.bar} data-visible={barVisible || indexOpen} onFocus={() => useReader.getState().showBar()}>
        <div className={styles.inner}>
          <span className={styles.brand}>
            <Mark />
            Rehal
          </span>
          <div className={styles.title}>
            <h1>{title}</h1>
            <p className={styles.meta}>{meta}</p>
          </div>
          <nav className={styles.turns} aria-label="Turn the page">
            <button type="button" className={styles.secondary} aria-pressed={indexOpen} onClick={() => setIndexOpen((on) => !on)}>
              Index
            </button>
            <button
              type="button"
              className={styles.secondary}
              aria-pressed={showEnglish}
              onClick={() => setShowEnglish((on) => !on)}
            >
              English
            </button>
            <button type="button" className={styles.secondary} onClick={() => requestTurn(-1)} disabled={!canPrev}>
              Previous page
            </button>
            <button type="button" className={styles.primary} onClick={() => requestTurn(1)} disabled={!canNext}>
              Next page
            </button>
          </nav>
        </div>
      </header>

      {showEnglish && segments.length > 0 && (
        <section className={styles.panel} aria-label="English of the open page">
          <div className={styles.inner}>
            {segments.map((seg) => (
              <article key={`${seg.surah}-${seg.start}`}>
                <h2>
                  {seg.nameLatin} {seg.start}–{seg.end}
                </h2>
                {showsBasmala(seg) && <p className={styles.basmala}>{BASMALA_ENGLISH}</p>}
                <ol start={seg.start}>
                  {seg.english.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.foot} data-visible={barVisible}>
        <div className={styles.inner}>
          <p className={styles.hint}>Tap a page to read it. While it is open, drag it from the outer edge in toward the spine to turn it.</p>
          <p className={styles.credit}>
            Arabic text: <a href="https://tanzil.net">Tanzil Project</a>, CC BY 3.0. Transliteration:{" "}
            <a href="https://www.allahsword.com">AllahsWord.com</a>, with permission. English: M. A. S. Abdel Haleem,
            The Qur’an (Oxford University Press), with permission.
          </p>
        </div>
      </footer>

      {segments.length > 0 && (
        <section className={styles.text} aria-live="polite">
          {segments.map((seg) => (
            <article key={`${seg.surah}-${seg.start}`} lang="ar" dir="rtl">
              <h2>{seg.nameArabic}</h2>
              {showsBasmala(seg) && <p>{BASMALA}</p>}
              <ol start={seg.start}>
                {seg.ayahs.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      )}

      <Index open={indexOpen} onClose={() => setIndexOpen(false)} />
    </main>
  );
}
