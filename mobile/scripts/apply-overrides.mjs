#!/usr/bin/env node
/**
 * Apply post-scrape patches to `features/today/namedays/stub-namedays.json`.
 *
 * The eortologio.gr scrape is incomplete (missing common nicknames) and has a
 * handful of spelling / gender errors that survive in modern Greek. Rather than
 * hand-editing the JSON (which would silently regress on next scrape), we keep
 * those corrections in `nameday-overrides.json` and re-apply them here.
 *
 * Run order:
 *   1. node scripts/build-namedays.mjs   (full scrape)
 *   2. node scripts/apply-overrides.mjs  (this script)
 *
 * Idempotent — running this twice produces the same output as running it once.
 *
 * Usage:
 *   node mobile/scripts/apply-overrides.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(here, '..', 'features', 'today', 'namedays', 'stub-namedays.json');
const overridesPath = join(here, 'nameday-overrides.json');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function applyOverrides(entries, overrides) {
  const byKey = new Map(entries.map((e) => [e.nameday_key, e]));

  // 1. Replace specific normalized forms (e.g. fix a typo). Done before addForms
  //    so any new form we'd add doesn't get mistaken for the typo target.
  for (const [key, replacements] of Object.entries(overrides.replaceForms ?? {})) {
    const entry = byKey.get(key);
    if (!entry) {
      console.error(`[overrides] replaceForms: key not found "${key}"`);
      continue;
    }
    entry.all_forms_normalized = entry.all_forms_normalized.map((f) => replacements[f] ?? f);
  }

  // 2. Add missing nicknames / forms. Set-deduped so re-applying is a no-op.
  for (const [key, formsToAdd] of Object.entries(overrides.addForms ?? {})) {
    const entry = byKey.get(key);
    if (!entry) {
      console.error(`[overrides] addForms: key not found "${key}"`);
      continue;
    }
    const set = new Set(entry.all_forms_normalized);
    for (const f of formsToAdd) set.add(f);
    entry.all_forms_normalized = [...set];
  }

  // 3. Fix primary_form (modern Greek spelling, gender, etc.).
  for (const [key, newPrimary] of Object.entries(overrides.fixPrimaryForm ?? {})) {
    const entry = byKey.get(key);
    if (!entry) {
      console.error(`[overrides] fixPrimaryForm: key not found "${key}"`);
      continue;
    }
    entry.primary_form = newPrimary;
  }

  // 4. Fix saint label (article gender agreement, spelling).
  for (const [key, newSaint] of Object.entries(overrides.fixSaint ?? {})) {
    const entry = byKey.get(key);
    if (!entry) {
      console.error(`[overrides] fixSaint: key not found "${key}"`);
      continue;
    }
    entry.saint = newSaint;
  }

  // 5. Drop bogus entries (e.g. Easter on a fixed date — it's not).
  let kept = entries;
  if (Array.isArray(overrides.remove) && overrides.remove.length > 0) {
    const removeSet = new Set(overrides.remove);
    kept = entries.filter((e) => !removeSet.has(e.nameday_key));
  }

  // 6. Add new entries (e.g. split Ιωάννα out of the masculine Ιωάννης row).
  //    Skipped silently if the key already exists — idempotent.
  const keptByKey = new Set(kept.map((e) => e.nameday_key));
  for (const newEntry of overrides.addEntries ?? []) {
    if (keptByKey.has(newEntry.nameday_key)) continue;
    kept.push(newEntry);
    keptByKey.add(newEntry.nameday_key);
  }

  return kept;
}

function writeCatalog(path, entries) {
  // Match the format `build-namedays.mjs` emits: one entry per line, [ ... ].
  const lines = entries.map((e) => '  ' + JSON.stringify(e));
  const body = '[\n' + lines.join(',\n') + '\n]\n';
  writeFileSync(path, body);
}

function main() {
  const overrides = loadJson(overridesPath);
  const entries = loadJson(catalogPath);
  const before = entries.length;
  const patched = applyOverrides(entries, overrides);
  writeCatalog(catalogPath, patched);
  process.stderr.write(
    `Patched catalog: ${before} → ${patched.length} entries (delta ${patched.length - before}).\n`,
  );
}

main();
