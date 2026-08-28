#!/usr/bin/env node
/**
 * Theme Manifest Generator
 *
 * Scans ui/public/themes/ for <id>.css files (one :root block per theme),
 * extracts preview colors using PostCSS, and generates manifest.json.
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

/** Curated display names for the theme pack (id → human name). */
const THEME_NAMES = {
  light: 'Light',
  dark: 'Dark',
  'winter-light': 'Winter Light',
  'modern-minimal': 'Modern Minimal',
  'modern-minimal-dark': 'Modern Minimal Dark',
  't3-chat': 'T3 Chat',
  twitter: 'Twitter',
  'mocha-mousse': 'Mocha Mousse',
  bubblegum: 'Bubblegum',
  'doom-64': 'Doom 64',
  catppuccin: 'Catppuccin',
  'catppuccin-latte': 'Catppuccin Latte',
  'catppuccin-frappe': 'Catppuccin Frappé',
  'catppuccin-macchiato': 'Catppuccin Macchiato',
  graphite: 'Graphite',
  perpetuity: 'Perpetuity',
  'kodama-grove': 'Kodama Grove',
  'cosmic-night': 'Cosmic Night',
  tangerine: 'Tangerine',
  'quantum-rose': 'Quantum Rose',
  nature: 'Nature',
  'bold-tech': 'Bold Tech',
  'elegant-luxury': 'Elegant Luxury',
  'amber-minimal': 'Amber Minimal',
  supabase: 'Supabase',
  'neo-brutalism': 'Neo Brutalism',
  'solar-dusk': 'Solar Dusk',
  claymorphism: 'Claymorphism',
  cyberpunk: 'Cyberpunk',
  'pastel-dreams': 'Pastel Dreams',
  'clean-slate': 'Clean Slate',
  caffeine: 'Caffeine',
  'ocean-breeze': 'Ocean Breeze',
  'retro-arcade': 'Retro Arcade',
  'midnight-bloom': 'Midnight Bloom',
  candyland: 'Candyland',
  'northern-lights': 'Northern Lights',
  'vintage-paper': 'Vintage Paper',
  'sunset-horizon': 'Sunset Horizon',
  'starry-night': 'Starry Night',
  claude: 'Claude',
  'claude-dark': 'Claude Dark',
  vercel: 'Vercel',
  'vercel-dark': 'Vercel Dark',
  mono: 'Mono',
  nord: 'Nord',
  'solarized-light': 'Solarized Light',
  'solarized-dark': 'Solarized Dark',
  'rose-pine': 'Rosé Pine',
  'everforest-dark': 'Everforest',
  dracula: 'Dracula',
  'tokyo-night': 'Tokyo Night',
  'gruvbox-dark': 'Gruvbox Dark',
  perplexity: 'Perplexity',
  // Theme pack #2
  'github-light': 'GitHub Light',
  'github-dark': 'GitHub Dark',
  'github-dim': 'GitHub Dim',
  'slack-light': 'Slack Light',
  'slack-dark': 'Slack Dark',
  'notion-light': 'Notion',
  'notion-dark': 'Notion Dark',
  'linear-light': 'Linear Light',
  'linear-dark': 'Linear Dark',
  discord: 'Discord',
  spotify: 'Spotify',
  'firebase-light': 'Firebase Light',
  'firebase-dark': 'Firebase Dark',
  'material-light': 'Material Light',
  'material-dark': 'Material Dark',
  poimandres: 'Poimandres',
  kanagawa: 'Kanagawa',
  zenburn: 'Zenburn',
  'ayu-light': 'Ayu Light',
  'ayu-dark': 'Ayu Dark',
  'ayu-mirage': 'Ayu Mirage',
  'one-light': 'One Light',
  'one-dark': 'One Dark',
  'flexoki-light': 'Flexoki Light',
  'flexoki-dark': 'Flexoki Dark',
  vesper: 'Vesper',
  lumen: 'Lumen',
  'night-owl': 'Night Owl',
  'synthwave-84': "Synthwave '84",
  cobalt2: 'Cobalt2',
  monokai: 'Monokai',
  'monokai-pro': 'Monokai Pro',
  palenight: 'Palenight',
  moonlight: 'Moonlight',
  horizon: 'Horizon',
  andromeda: 'Andromeda',
  'gruvbox-light': 'Gruvbox Light',
  'everforest-light': 'Everforest Light',
  'rose-pine-dawn': 'Rosé Pine Dawn',
  'rose-pine-moon': 'Rosé Pine Moon',
  'tokyo-night-light': 'Tokyo Night Light',
  'tokyo-night-storm': 'Tokyo Night Storm',
  'nord-light': 'Nord Light',
  sonokai: 'Sonokai',
  iceberg: 'Iceberg',
  miramare: 'Miramare',
  'melange-light': 'Melange Light',
  'melange-dark': 'Melange Dark',
  oxocarbon: 'Oxocarbon',
  'high-contrast-dark': 'High Contrast Dark',
};

/**
 * Resolve a human-readable name for a theme id.
 * Falls back to capitalizing the id for themes not in the curated map.
 */
function deriveName(id) {
  return THEME_NAMES[id] ?? capitalize(id.replaceAll('-', ' '));
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
  const cssFiles = entries.filter((f) => f.endsWith('.css') && f !== 'manifest.json').sort();

  if (cssFiles.length === 0) {
    console.error('❌ No theme CSS files found in', THEMES_DIR);
    process.exit(1);
  }

  const manifest = [];
  const seenIds = new Set();

  for (const file of cssFiles) {
    const id = basename(file, '.css');
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

  // Sort manifest: app defaults first, then light themes, then dark themes (alphabetical within)
  const DEFAULT_ORDER = { light: 0, dark: 1 };
  manifest.sort((a, b) => {
    const aDefault = DEFAULT_ORDER[a.id];
    const bDefault = DEFAULT_ORDER[b.id];

    if (aDefault !== undefined || bDefault !== undefined) {
      return (aDefault ?? 99) - (bDefault ?? 99);
    }

    if (a.mode !== b.mode) {
      return a.mode === 'light' ? -1 : 1;
    }

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
