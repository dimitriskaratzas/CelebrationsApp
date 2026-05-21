#!/usr/bin/env node
/**
 * Scrape eortologio.gr's monthly nameday pages and emit
 * `features/today/namedays/stub-namedays.json`.
 *
 * Source: https://www.eortologio.gr/data/eortes/eortes_<month>.php
 * Output rows match the format: <td>KEY (name1, name2, ...)</td><td>DAY</td><td>MONTH_GENITIVE</td>
 *
 * Movable feasts (Pascha, etc.) are not on the monthly pages and are appended
 * manually at the end of the file.
 *
 * Usage:
 *   node mobile/scripts/build-namedays.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MONTHS = [
  ['january',   1,  'Ιανουαρίου'],
  ['february',  2,  'Φεβρουαρίου'],
  ['march',     3,  'Μαρτίου'],
  ['april',     4,  'Απριλίου'],
  ['may',       5,  'Μαΐου'],
  ['june',      6,  'Ιουνίου'],
  ['july',      7,  'Ιουλίου'],
  ['august',    8,  'Αυγούστου'],
  ['september', 9,  'Σεπτεμβρίου'],
  ['october',   10, 'Οκτωβρίου'],
  ['november',  11, 'Νοεμβρίου'],
  ['december',  12, 'Δεκεμβρίου'],
];

// Strips accents, lowercases, and normalizes final sigma.
const ACCENT_MAP = {
  ά: 'α', έ: 'ε', ή: 'η', ί: 'ι', ϊ: 'ι', ΐ: 'ι',
  ό: 'ο', ύ: 'υ', ϋ: 'υ', ΰ: 'υ', ώ: 'ω', ς: 'σ',
};

function normalize(s) {
  const lowered = s.toLowerCase().trim();
  let out = '';
  for (const ch of lowered) out += ACCENT_MAP[ch] ?? ch;
  return out;
}

// Greek → Latin transliteration for nameday_key construction.
const TRANSLIT = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th',
  ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p',
  ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};

function toKey(rawGreek) {
  const lowered = normalize(rawGreek);
  let out = '';
  for (const ch of lowered) {
    if (TRANSLIT[ch]) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === ' ' || ch === '-' || ch === '_') out += '_';
  }
  return out.replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// Trims annotation suffixes like " - για παντρεμένες γυναίκες" from a primary form.
function cleanPrimary(name) {
  const idx = name.indexOf(' - ');
  return idx > 0 ? name.slice(0, idx).trim() : name.trim();
}

// Best-effort Greek saint label heuristic.
function saintLabel(primary) {
  const cleaned = cleanPrimary(primary);
  // Multi-word celebrations (e.g. "Τριών Ιεραρχών") — return as-is.
  if (cleaned.includes(' ')) return cleaned;
  // Normalize before checking the ending so accented "ή" matches "η" etc.
  const normEnd = normalize(cleaned).slice(-1);
  const female = ['α', 'η', 'ω'].includes(normEnd);
  return (female ? 'Αγία ' : 'Άγιος ') + cleaned;
}

async function fetchMonth(slug) {
  const url = `https://www.eortologio.gr/data/eortes/eortes_${slug}.php`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (CelebrationsApp/build-namedays)' },
  });
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  return res.text();
}

// Extract one entry from a row's TD content. Some rows have an optional
// annotation between the key and the names list:
//   "ΓΕΩΡΓΙΟΣ (Γεώργιος, ...)"           — typical
//   "ΓΕΩΡΓΙΟΣ (*) (Γεώργιος, ...)"       — with footnote marker
//   "ΠΑΝΑΓΙΩΤΗΣ (4) (Παναγιώτης, ...)"   — with numeric annotation
// We want the LAST parens group's content.
function parseRow(td) {
  // Find the last `(...)` group. Greedy "everything before" + lazy at the end.
  const m = /^(.+?)\s*\(([^()]*)\)\s*$/.exec(td);
  if (!m) return null;
  let keyPart = m[1].trim();
  const namesPart = m[2];

  // Strip any inline annotations like "(*)" or "(4)" from the key part.
  keyPart = keyPart.replace(/\s*\([^()]*\)\s*/g, ' ').trim();

  const rawNames = namesPart.split(/,|;/).map((s) => s.trim()).filter(Boolean);
  if (rawNames.length === 0) return null;

  // The first name in the list is the canonical accented form.
  const primary = cleanPrimary(rawNames[0]);

  // Normalize every form and dedupe.
  const normSet = new Set();
  for (const n of rawNames) {
    // Strip parenthesised commentary baked into a name (e.g. "Μαρία - για παντρεμένες γυναίκες").
    const cleaned = cleanPrimary(n);
    const norm = normalize(cleaned);
    if (norm.length === 0) continue;
    normSet.add(norm);
  }

  return {
    key: toKey(keyPart),
    primary,
    normalizedForms: [...normSet],
  };
}

const ROW_RE = /<tr>\s*<td>([^<]+)<\/td>\s*<td>(\d{1,2})<\/td>\s*<td>([^<]+)<\/td>/g;

async function buildCatalog() {
  const entries = [];
  const seenKeys = new Set();

  for (const [slug, monthNum, monthGenitive] of MONTHS) {
    process.stderr.write(`fetching ${slug}…\n`);
    const html = await fetchMonth(slug);
    let m;
    while ((m = ROW_RE.exec(html)) !== null) {
      const [, td, dayStr, monthLabel] = m;
      // Sanity: only accept rows for the month we're scraping. eortologio.gr is
      // inconsistent with diacritics (e.g. May is written "Μαίου" on the page but
      // "Μαΐου" everywhere else), so compare accent-stripped.
      if (!normalize(monthLabel).includes(normalize(monthGenitive).slice(0, 5))) continue;
      const day = Number(dayStr);
      if (!Number.isInteger(day) || day < 1 || day > 31) continue;

      const parsed = parseRow(td);
      if (!parsed) continue;

      // Disambiguate duplicate keys across months (e.g. Θεόδωρος appears in Feb + Sep).
      // Also collision-suffix if the date-qualified key would itself collide.
      let key = parsed.key;
      if (seenKeys.has(key)) {
        key = `${key}_${monthNum}_${day}`;
        let n = 2;
        while (seenKeys.has(key)) key = `${parsed.key}_${monthNum}_${day}_${n++}`;
      }
      seenKeys.add(key);

      entries.push({
        nameday_key: key,
        primary_form: parsed.primary,
        all_forms_normalized: parsed.normalizedForms,
        celebration: { type: 'fixed', month: monthNum, day },
        saint: saintLabel(parsed.primary),
      });
    }
  }

  // Movable feasts — not on eortologio.gr monthly pages.
  const movable = [
    {
      nameday_key: 'theodoros_tiron_movable',
      primary_form: 'Θεόδωρος',
      all_forms_normalized: ['θεοδωροσ','θεοδωροστιρων'],
      celebration: { type: 'easter_offset', offset: -36 },
      saint: 'Άγιος Θεόδωρος ο Τήρων (Α\' Σαββάτου Νηστειών)',
    },
    {
      nameday_key: 'anastasios_pascha',
      primary_form: 'Αναστάσης / Αναστασία',
      all_forms_normalized: ['αναστασιοσ','αναστασησ','τασοσ','αναστασια','νατασα','anastasios','tasos','anastasia'],
      celebration: { type: 'easter_offset', offset: 0 },
      saint: 'Άγια Ανάσταση του Κυρίου',
    },
    {
      nameday_key: 'lampros_pascha',
      primary_form: 'Λάμπρος / Λαμπρινή',
      all_forms_normalized: ['λαμπροσ','λαμπρινη','λαμπρινα','lampros','lambros','lambrini'],
      celebration: { type: 'easter_offset', offset: 0 },
      saint: 'Πάσχα — Λαμπρή',
    },
    {
      nameday_key: 'zoodochos_pigi',
      primary_form: 'Ζωή',
      all_forms_normalized: ['ζωη','ζωιτσα','zoi','zoe'],
      celebration: { type: 'easter_offset', offset: 5 },
      saint: 'Ζωοδόχου Πηγής',
    },
    {
      nameday_key: 'thomas_kyriaki',
      primary_form: 'Θωμάς',
      all_forms_normalized: ['θωμασ','thomas','tom'],
      celebration: { type: 'easter_offset', offset: 7 },
      saint: 'Άγιος Θωμάς ο Απόστολος (Κυριακή του Θωμά)',
    },
    {
      nameday_key: 'agiou_pnevmatos',
      primary_form: 'Αγίου Πνεύματος',
      all_forms_normalized: ['πνευματια','πνευμα'],
      celebration: { type: 'easter_offset', offset: 50 },
      saint: 'Αγίου Πνεύματος',
    },
  ];

  for (const m of movable) {
    if (!seenKeys.has(m.nameday_key)) {
      entries.push(m);
      seenKeys.add(m.nameday_key);
    }
  }

  return entries;
}

async function main() {
  const entries = await buildCatalog();
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, '..', 'features', 'today', 'namedays', 'stub-namedays.json');

  // Pretty-print with one entry per line (compact array-of-objects).
  const lines = entries.map((e) => '  ' + JSON.stringify(e));
  const body = '[\n' + lines.join(',\n') + '\n]\n';
  writeFileSync(outPath, body);

  process.stderr.write(`Wrote ${entries.length} entries → ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
