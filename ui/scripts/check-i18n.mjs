// N-18: diff translation keys across all locale files and fail (non-zero exit)
// when keys are missing between locales. No dependencies — plain Node.
//
// Usage: npm run check:i18n (from ui/) or npm run check:i18n --workspace=ui

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const i18nDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'i18n');

/** Flatten a nested translation object into dot-separated key paths. */
function flattenKeys(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenKeys(value, path, out);
    } else {
      out.add(path);
    }
  }

  return out;
}

const localeFiles = readdirSync(i18nDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (localeFiles.length === 0) {
  console.error(`check:i18n — no locale files found in ${i18nDir}`);
  process.exit(1);
}

/** Map<locale, Set<key>> */
const keysByLocale = new Map();

for (const file of localeFiles) {
  const locale = file.replace(/\.json$/, '');
  let json;

  try {
    json = JSON.parse(readFileSync(join(i18nDir, file), 'utf8'));
  } catch (err) {
    console.error(`check:i18n — ${file} is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  keysByLocale.set(locale, flattenKeys(json));
}

// Union of all keys across locales = the expected key set
const allKeys = new Set();

for (const keys of keysByLocale.values()) {
  for (const key of keys) allKeys.add(key);
}

const missing = [];

for (const locale of keysByLocale.keys()) {
  const keys = keysByLocale.get(locale);

  for (const key of allKeys) {
    if (!keys.has(key)) {
      missing.push({ locale, key });
    }
  }
}

if (missing.length === 0) {
  console.log(`check:i18n — OK: ${keysByLocale.size} locales, ${allKeys.size} keys, no missing keys.`);
  process.exit(0);
}

console.error(`check:i18n — ${missing.length} missing translation key(s) across ${keysByLocale.size} locales:\n`);

for (const { locale, key } of missing) {
  console.error(`  [${locale}] missing key: ${key}`);
}

console.error(`\nRun against: ${i18nDir}`);
process.exit(1);
