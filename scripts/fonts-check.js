#!/usr/bin/env node
/* fonts-check — the webfont request in nuxt.config.js must be one the
   provider can actually answer (VKB-157).

   A provider does not complain about a subset a family has never shipped: it
   sends nothing, and the glyphs fall back to a system face per character, in
   every locale, with no error anywhere.
*/

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG = join(ROOT, 'nuxt.config.js');

const METADATA_URL = 'https://fonts.google.com/metadata/fonts';
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// fontless `defaultValues` — what a face inherits when neither the family nor
// `fonts.defaults` names it. Mirrored rather than imported so the check states
// the request it is verifying. The asymmetry to know: an upstream default
// REMOVED shows up as a failure here, one ADDED silently under-requests and
// passes.
const MODULE_DEFAULTS = {
  weights: [400],
  styles: ['normal', 'italic'],
  subsets: [
    'cyrillic-ext',
    'cyrillic',
    'greek-ext',
    'greek',
    'vietnamese',
    'latin-ext',
    'latin',
  ],
};

// Google serves a `menu` subset for its own font picker; it is never a
// coverage claim about a script.
const NON_SCRIPT_SUBSETS = new Set(['menu']);

const fail = (message) => {
  console.error(`fonts-check: ${message}`);
  process.exit(1);
};

// Regex alone cannot find the end of a nested array of objects.
const sliceBlock = (source, openIndex) => {
  const open = source[openIndex];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let quote = '';
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (quote !== '') {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return null;
};

const blockAfter = (source, label) => {
  const at = source.indexOf(label);
  if (at === -1) return null;
  return sliceBlock(source, at + label.length - 1);
};

// Scanned rather than regexed: the glob in `ignore: ['**/.claude/**']` reads
// as a block-comment open and close, so a regex pattern eats half the config.
const stripComments = (source) => {
  let out = '';
  let quote = '';
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote !== '') {
      out += char;
      if (char === '\\') out += source[++i] ?? '';
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      out += char;
      continue;
    }
    if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    out += char;
  }
  return out;
};

const declares = (block, key) =>
  new RegExp(`(^|[\\s{,])${key}\\s*:`).test(block);

// An array holding only quoted strings, integers and separators. A spread or
// an identifier inside one is invisible to the readers below, which would
// verify the literals and stay silent about the rest.
const LITERALS_ONLY = /^\[[\s,]*(?:(?:'[^']*'|\d+)[\s,]*)*\]$/;

// `null` means "absent, inherit the default". A key that IS declared but is
// not a readable literal — hoisted into a const, spread in — must never reach
// that path: it would inherit weight 400, which nearly every family ships,
// and print a green line for a request nobody verified.
const readList = (block, key, parse) => {
  const list = blockAfter(block, `${key}: [`);
  if (list === null) {
    if (declares(block, key)) {
      fail(
        `\`${key}\` is declared in nuxt.config.js but is not an inline array ` +
          'literal, so this check cannot read what is being requested',
      );
    }
    return null;
  }
  if (!LITERALS_ONLY.test(list)) {
    fail(
      `\`${key}: ${list}\` in nuxt.config.js holds something this check ` +
        'cannot read; only quoted strings and integers are verifiable',
    );
  }
  const values = parse(list);
  if (values.length === 0) {
    fail(`\`${key}: []\` in nuxt.config.js leaves nothing to verify`);
  }
  return values;
};

const readStrings = (block, key) =>
  readList(block, key, (list) =>
    Array.from(list.matchAll(/'([^']*)'/g), (match) => match[1]),
  );

const readNumbers = (block, key) =>
  readList(block, key, (list) =>
    Array.from(list.matchAll(/\d+/g), (match) => Number(match[0])),
  );

const readString = (block, key) => {
  const match = block.match(new RegExp(`${key}:\\s*'([^']*)'`));
  return match === null ? null : match[1];
};

const parseConfig = () => {
  const source = stripComments(readFileSync(CONFIG, 'utf8'));

  const fonts = blockAfter(source, 'fonts: {');
  if (fonts === null) fail(`no \`fonts\` block in ${CONFIG}`);

  // Omitting `fonts.defaults` is a legitimate config meaning "inherit
  // everything"; declaring it as something unreadable is not.
  const declared = blockAfter(fonts, 'defaults: {');
  if (declared === null && declares(fonts, 'defaults')) {
    fail('`fonts.defaults` is declared but is not an inline object literal');
  }
  const defaultsBlock = declared ?? '{}';
  const defaults = {
    weights: readNumbers(defaultsBlock, 'weights') ?? MODULE_DEFAULTS.weights,
    styles: readStrings(defaultsBlock, 'styles') ?? MODULE_DEFAULTS.styles,
    subsets: readStrings(defaultsBlock, 'subsets') ?? MODULE_DEFAULTS.subsets,
  };

  const familiesBlock = blockAfter(fonts, 'families: [');
  if (familiesBlock === null)
    fail('no `fonts.families` list in nuxt.config.js');

  const families = [];
  let cursor = 0;
  let between = '';
  for (let at = familiesBlock.indexOf('{'); at !== -1; ) {
    const entry = sliceBlock(familiesBlock, at);
    if (entry === null) break;
    between += familiesBlock.slice(cursor, at);
    cursor = at + entry.length;
    families.push({
      name: readString(entry, 'name'),
      provider: readString(entry, 'provider'),
      weights: readNumbers(entry, 'weights') ?? defaults.weights,
      styles: readStrings(entry, 'styles') ?? defaults.styles,
      subsets: readStrings(entry, 'subsets') ?? defaults.subsets,
    });
    at = familiesBlock.indexOf('{', cursor);
  }
  between += familiesBlock.slice(cursor);

  // Whatever sits around the object literals must be brackets, commas and
  // whitespace. A spread or a factory call there is a family this check would
  // otherwise skip without a word.
  if (/[^[\]\s,]/.test(between)) {
    fail(
      '`fonts.families` holds an entry that is not an inline object literal, ' +
        'so this check cannot see every family being requested',
    );
  }

  if (families.length === 0)
    fail('`fonts.families` is empty in nuxt.config.js');
  return families;
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const fetchCatalog = async () => {
  let lastError = null;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(METADATA_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { familyMetadataList } = await response.json();
      const catalog = new Map();
      for (const family of familyMetadataList)
        catalog.set(family.family, family);
      return catalog;
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  fail(
    `could not read the Google Fonts metadata index (${METADATA_URL}): ` +
      `${lastError.message}. The request is unverified, so this is a ` +
      'failure rather than a pass.',
  );
};

const offersWeight = (meta, weight, isItalic) => {
  const key = isItalic ? `${weight}i` : String(weight);
  if (Object.hasOwn(meta.fonts, key)) return true;

  const axis = (meta.axes ?? []).find((entry) => entry.tag === 'wght');
  if (axis === undefined || weight < axis.min || weight > axis.max)
    return false;

  const styled = Object.keys(meta.fonts).some((name) =>
    isItalic ? name.endsWith('i') : !name.endsWith('i'),
  );
  return styled;
};

const checkFamily = (family, catalog, failures) => {
  if (family.name === null) {
    failures.push('UNNAMED  a `families` entry has no `name`');
    return;
  }
  if (family.provider !== 'google') {
    failures.push(
      `PROVIDER ${family.name} — provider ${family.provider ?? '(none)'} is ` +
        'unknown to this check; teach it how to ask that provider',
    );
    return;
  }

  const meta = catalog.get(family.name);
  if (meta === undefined) {
    failures.push(`UNKNOWN  ${family.name} — no such family on Google Fonts`);
    return;
  }

  const offered = new Set(
    meta.subsets.filter((name) => !NON_SCRIPT_SUBSETS.has(name)),
  );
  for (const subset of family.subsets) {
    if (!offered.has(subset)) {
      failures.push(
        `SUBSET   ${family.name} — no \`${subset}\` subset; offered: ` +
          Array.from(offered).sort().join(', '),
      );
    }
  }

  for (const style of family.styles) {
    if (style !== 'normal' && style !== 'italic') {
      failures.push(
        `STYLE    ${family.name} — style \`${style}\` is unknown to this ` +
          'check, which would otherwise report it as covered',
      );
      continue;
    }
    const isItalic = style === 'italic';
    for (const weight of family.weights) {
      if (!offersWeight(meta, weight, isItalic)) {
        failures.push(
          `WEIGHT   ${family.name} — no ${weight} ${style}; offered: ` +
            Object.keys(meta.fonts).join(', '),
        );
      }
    }
  }
};

const main = async () => {
  const families = parseConfig();
  const catalog = await fetchCatalog();

  const failures = [];
  for (const family of families) checkFamily(family, catalog, failures);

  if (failures.length > 0) {
    console.error(`\nfonts-check: ${failures.length} coverage failure(s):`);
    for (const line of failures) console.error('  ' + line);
    process.exit(1);
  }

  for (const family of families) {
    console.log(
      `fonts-check: ${family.name} ${family.styles.join('/')} ` +
        `${family.weights.join(',')} · ${family.subsets.join(', ')} ✓`,
    );
  }
  console.log('fonts-check: every configured face is one the provider ships ✓');
};

await main();
