#!/usr/bin/env node
/**
 * Theme Manifest Generator
 *
 * Scans ui/public/themes/ for *-theme.css files, extracts preview colors
 * using PostCSS, and generates manifest.json.
 *
 * Usage: node scripts/generate-theme-manifest.mjs
 */

import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import postcss from 'postcss';

const THEMES_DIR = join(import.meta.dirname, '..', 'public', 'themes');
const OUTPUT_FILE = join(THEMES_DIR, 'manifest.json');

const REQUIRED_PREVIEW_VARS = ['--primary', '--muted', '--foreground', '--card', '--border'];
const BACKGROUND_VAR = '--background';

/**
 * Derive a human-readable name from a theme id.
 * "light" → "Light", "light1" → "Light 1", "dark" → "Dark"
 */
function deriveName(id) {
  const match = id.match(/^(.*?)(\d+)$/);

  if (match) {
    return `${capitalize(match[1])} ${match[2]}`;
  }

  return capitalize(id);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Determine light/dark mode from the --background oklch value.
 * oklch(L C H) where L is lightness in [0, 1].
 * L > 0.5 → light, otherwise dark.
 */
function detectMode(backgroundValue) {
  const oklchMatch = backgroundValue.match(/oklch\(\s*([\d.]+)/);

  if (oklchMatch) {
    const lightness = parseFloat(oklchMatch[1]);

    return lightness > 0.5 ? 'light' : 'dark';
  }

  // Fallback: if background is very light hex → light, otherwise dark
  const hexMatch = backgroundValue.match(/#([0-9a-f]{6})/i);

  if (hexMatch) {
    const hex = hexMatch[1];
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? 'light' : 'dark';
  }

  // Default to light if we can't determine
  console.warn(`    ⚠ Could not determine mode from background: "${backgroundValue}", defaulting to "light"`);

  return 'light';
}

/**
 * Extract CSS custom property values from a parsed PostCSS root.
 */
function extractVariables(root) {
  const vars = new Map();

  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) {
      vars.set(decl.prop, decl.value);
    }
  });

  return vars;
}

async function main() {
  console.log('🎨 Generating theme manifest...\n');

  const entries = await readdir(THEMES_DIR);
  const cssFiles = entries.filter((f) => f.endsWith('-theme.css')).sort();

  if (cssFiles.length === 0) {
    console.error('❌ No *-theme.css files found in', THEMES_DIR);
    process.exit(1);
  }

  const manifest = [];
  const seenIds = new Set();

  for (const file of cssFiles) {
    const id = basename(file, '-theme.css');
    console.log(`  📄 ${file} → id: "${id}"`);

    // Check for duplicate ids
    if (seenIds.has(id)) {
      console.error(`❌ Duplicate theme id: "${id}" (from ${file})`);
      process.exit(1);
    }

    seenIds.add(id);

    // Read and parse CSS
    const cssPath = join(THEMES_DIR, file);
    const cssContent = await readFile(cssPath, 'utf-8');
    let root;

    try {
      root = postcss.parse(cssContent, { from: cssPath });
    } catch (err) {
      console.error(`❌ Failed to parse ${file}: ${err.message}`);
      process.exit(1);
    }

    const vars = extractVariables(root);

    // Validate required preview variables
    const missing = REQUIRED_PREVIEW_VARS.filter((v) => !vars.has(v));

    if (missing.length > 0) {
      console.error(`❌ ${file} is missing required CSS variables: ${missing.join(', ')}`);
      process.exit(1);
    }

    // Extract preview colors
    const preview = {
      primary: vars.get('--primary'),
      muted: vars.get('--muted'),
      foreground: vars.get('--foreground'),
      card: vars.get('--card'),
      border: vars.get('--border'),
    };

    // Detect mode from background
    const backgroundValue = vars.get(BACKGROUND_VAR) ?? '';
    const mode = detectMode(backgroundValue);

    manifest.push({
      id,
      name: deriveName(id),
      mode,
      css: file,
      preview,
    });
  }

  // Sort manifest: light and dark first, then alphabetically
  manifest.sort((a, b) => {
    if (a.id === 'light') return -1;
    if (b.id === 'light') return 1;
    if (a.id === 'dark') return -1;
    if (b.id === 'dark') return 1;

    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  const newContent = JSON.stringify(manifest, null, 2) + '\n';

  // Only write if the manifest has actually changed
  let existingContent = '';

  try {
    await access(OUTPUT_FILE);
    existingContent = await readFile(OUTPUT_FILE, 'utf-8');
  } catch {
    // File doesn't exist yet — will be created
  }

  if (existingContent === newContent) {
    console.log(`\n✅ manifest.json is up to date (${manifest.length} themes) — no changes`);
  } else {
    await writeFile(OUTPUT_FILE, newContent, 'utf-8');
    console.log(`\n✅ Generated manifest.json with ${manifest.length} themes → ${OUTPUT_FILE}`);
  }
}

main().catch((err) => {
  console.error('❌ Theme manifest generation failed:', err);
  process.exit(1);
});
