// Builds the 114 surahs: Tanzil Arabic, Abdel Haleem English, and transliteration.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const content = join(root, "content");
const outDir = join(root, "src/content");
const SOURCE_SHA256 = "7f30c647331a61100ebf24a80507dc0fcdd9f2df97f1312b5b2dfcb982a7f326";

const tanzilRaw = readFileSync(join(content, "tanzil-uthmani.txt"));
const sha = createHash("sha256").update(tanzilRaw).digest("hex");
if (sha !== SOURCE_SHA256) throw new Error(`Tanzil source checksum mismatch: ${sha}`);

const tanzilText = tanzilRaw.toString("utf8");
const tanzilLines = new Map();
for (const line of tanzilText.split("\n")) {
  const m = /^(\d+)\|(\d+)\|(.+)$/.exec(line);
  if (m) tanzilLines.set(`${m[1]}:${m[2]}`, m[3]);
}
const notice = tanzilText
  .split("\n")
  .filter((l) => l.startsWith("#"))
  .join("\n");
const basmala = tanzilLines.get("1:1");

const latinSrc = JSON.parse(readFileSync(join(content, "transliteration-source.json"), "utf8"));
const haleemList = JSON.parse(readFileSync(join(content, "eng-abdelhaleem.json"), "utf8")).quran;
const overlay = JSON.parse(readFileSync(join(content, "allahsword-latin.json"), "utf8"));

const englishBySurah = {};
for (const row of haleemList) {
  const s = String(row.chapter);
  if (!englishBySurah[s]) englishBySurah[s] = [];
  englishBySurah[s].push(row.text);
}

const ayahs = {};
const latin = { ...latinSrc.surahs };
const english = {};
for (let s = 1; s <= 114; s++) {
  const key = String(s);
  const verses = [];
  for (let a = 1; tanzilLines.has(`${s}:${a}`); a++) {
    const source = tanzilLines.get(`${s}:${a}`);
    if (s !== 1 && s !== 9 && a === 1) {
      const m = /^(بّ?ِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ )/.exec(source);
      if (!m) throw new Error(`${s}:1 has no basmala prefix`);
      verses.push(source.slice(m[1].length));
    } else {
      verses.push(source);
    }
  }
  ayahs[key] = verses;
  if (overlay[key]) {
    if (overlay[key].length !== verses.length) throw new Error(`AllahsWord latin for ${s} has the wrong length`);
    latin[key] = overlay[key];
  }
  const en = englishBySurah[key];
  if (!en || en.length !== verses.length) throw new Error(`English for surah ${s} does not match the Arabic`);
  english[key] = en;
  if (!latin[key] || latin[key].length !== verses.length) throw new Error(`Latin for surah ${s} does not match the Arabic`);
  verses.forEach((ayah, i) => {
    const source = tanzilLines.get(`${s}:${i + 1}`);
    if (s !== 1 && s !== 9 && i === 0) {
      if (!source.endsWith(ayah) || source.length <= ayah.length) throw new Error(`Ayah ${s}:1 does not match Tanzil`);
    } else if (source !== ayah) {
      throw new Error(`Ayah ${s}:${i + 1} does not match Tanzil`);
    }
  });
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "ayahs.json"),
  JSON.stringify({ source: "Tanzil Quran Text (Uthmani, Version 1.1)", sourceSha256: sha, notice, basmala, surahs: ayahs }) + "\n",
);
writeFileSync(
  join(outDir, "english.json"),
  JSON.stringify({
    source: "M. A. S. Abdel Haleem, The Qur'an: A New Translation (Oxford University Press)",
    license: "Used with permission of the rights holders",
    notice: "The complete translation, including the translator's brackets.",
    basmala: "In the name of God, the Lord of Mercy, the Giver of Mercy",
    surahs: english,
  }) + "\n",
);
writeFileSync(
  join(outDir, "transliteration.json"),
  JSON.stringify({
    source: "AllahsWord.com (surahs 1, 103, 108, 112–114) and English Transliteration via alquran.cloud",
    url: "https://www.allahsword.com",
    license: "AllahsWord passages used with permission. Other surahs: alquran.cloud en.transliteration.",
    notice: "Surahs 1, 103, 108 and 112–114 follow AllahsWord's spelling. The rest is a published English transliteration. Tajweed colours are not reproduced.",
    basmala: overlay["1"][0],
    surahs: latin,
  }) + "\n",
);
writeFileSync(
  join(outDir, "meta.json"),
  JSON.stringify({
    mushafPages: 604,
    surahs: latinSrc.meta,
    juz: latinSrc.juz,
    pages: latinSrc.pages,
  }) + "\n",
);

const nAyahs = Object.values(ayahs).reduce((n, a) => n + a.length, 0);
console.log(`Verified ${nAyahs} ayahs in 114 surahs against Tanzil (${sha.slice(0, 12)})`);
