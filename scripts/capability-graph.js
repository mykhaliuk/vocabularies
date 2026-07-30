#!/usr/bin/env node
/* capability-graph — derive the UI ↔ API ↔ domain ↔ entity graph from code.

   The graph answers a planning-time question: "the feature I am about to
   build needs screen X to reach entity Y — does that path exist yet?"
   A hand-drawn answer rots within a sprint, so every edge here is derived
   from the source tree instead, by the cheapest method that is still
   reliable for that edge:

     file  → route      Nitro filename convention (no parsing at all)
     route → operation  named imports of server/domain/*
     module→ entity     named imports of db/schema/* (domain AND infra)
     entity→ columns    runtime import + drizzle getTableColumns (exact)
     client→ route      '/api/...' literals inside $fetch/useFetch and
                        locals bound to useRequestFetch()

   The last edge is the weak one: a computed endpoint is invisible to a
   lexical scan. Rather than drop such a call silently — the worst failure
   mode an analyser has, being indistinguishable from "all clear" — the
   scan reports it as UNRESOLVED and asks for a `graph-endpoint`
   annotation.

   Known limits, deliberate for v1:
   - Entity edges are per MODULE, not per operation. Splitting them by
     operation means guessing where one function body ends, which
     misattributes silently the moment a helper appears between exports.
   - Generic type arguments are skipped by bracket counting, so a generic
     containing `>` in an arrow type (`<(a) => b>`) would confuse the
     scanner. None exists today; it would surface as UNRESOLVED, not as a
     wrong edge.
   - `segmentsMatch` treats an unresolved call segment (`:*`) as matching
     ANY route segment, param or literal, so a literal route added beside a
     dynamic one at the same depth can silently absorb a call and suppress
     an ORPHAN/DANGLING finding.

   Modes:
     build  rewrite docs/capability-graph.md
     check  rebuild in memory and fail if the committed file differs
*/

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT = 'docs/capability-graph.md';

const CLIENT_ROOTS = [
  'components',
  'composables',
  'layouts',
  'middleware',
  'pages',
  'shared',
];
const CLIENT_FILES = ['app.vue', 'error.vue'];
const API_ROOT = 'server/api';
const DOMAIN_DIR = 'domain';
const DOMAIN_ROOT = `server/${DOMAIN_DIR}`;
const INFRA_ROOT = 'server/utils';
const SCHEMA_ENTRY = 'db/schema/index.ts';

const CODE_EXTENSION_RE = /\.(?:vue|(?:m|c)?(?:j|t)sx?)$/;
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head'];

// $fetch and useFetch carry an API path as their first argument. Bare
// fetch() is also used for R2 uploads, so it counts only when the literal
// is an /api/ path and it never raises UNRESOLVED.
const API_CALLERS = ['$fetch', 'useFetch', 'useLazyFetch'];
const LOOSE_CALLERS = ['fetch'];

/* useRequestFetch() returns a $fetch bound to the incoming request (it
   forwards cookies during SSR), and callers bind it to a local name. The
   name is arbitrary, so the binding has to be read rather than guessed —
   without this, a screen that fetches only through it looks like it calls
   nothing, and its route reads as an orphan. */
const FETCH_BINDING_RE =
  /(?:const|let|var)\s+(\w+)\s*=\s*useRequestFetch\s*\(/g;

const COMMENT_LINE_RE = /^\s*\/\/\s?(.*)$/;
const ENDPOINT_HINT_RE = /graph-endpoint:\s*(\S+)/g;
const TICKET_RE = /\bVKB-\d+\b/;

/* Two annotations answer "why does this route have no caller?", and they
   are not interchangeable:
     graph-allow-orphan  no client will EVER call it (queue, emailed link)
     graph-pending       a client will, once <ticket> lands
   Collapsing the second into the first is how a real gap gets silenced
   for good, so `pending` demands a ticket and goes stale on wiring. */
const ANNOTATION_RE = (key) =>
  new RegExp(`^\\s*//\\s*graph-${key}:\\s*(\\S.*?)\\s*$`);

/* The reason may wrap across following comment lines — the 80-column
   limit makes that the common case, and a reason truncated at the first
   newline reads as a broken sentence in the report. */
export const readAnnotation = (source, key) => {
  const pattern = ANNOTATION_RE(key);
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].match(pattern);
    if (!start) continue;
    const parts = [start[1]];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].match(COMMENT_LINE_RE);
      if (!next || next[1].trim() === '') break;
      parts.push(next[1].trim());
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  return null;
};

const walk = (relDir, acc) => {
  let entries;
  try {
    entries = readdirSync(join(ROOT, relDir), { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const dirent of entries) {
    const child = `${relDir}/${dirent.name}`;
    if (dirent.isDirectory()) walk(child, acc);
    else if (CODE_EXTENSION_RE.test(dirent.name)) acc.push(child);
  }
  return acc;
};

const read = (relFile) => readFileSync(join(ROOT, relFile), 'utf8');

/* Comments are blanked in place — same length, same newlines — so offsets
   and line numbers stay valid while commented-out calls stop counting. */
export const maskComments = (text) => {
  const out = text.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) {
      if (out[i] !== '\n') out[i] = ' ';
    }
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i);
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      blank(i, end === -1 ? text.length : end);
      i = end === -1 ? text.length : end;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '<' && text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      const stop = end === -1 ? text.length : end + 3;
      blank(i, stop);
      i = stop;
      continue;
    }
    i++;
  }
  return out.join('');
};

/* Returns the index just past the closing quote. Template literals may
   nest ${ } holding further strings, so the walk is recursive. */
export const skipString = (text, start) => {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (quote === '`' && ch === '$' && text[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < text.length && depth > 0) {
        const inner = text[i];
        if (inner === '"' || inner === "'" || inner === '`') {
          i = skipString(text, i);
          continue;
        }
        if (inner === '{') depth++;
        else if (inner === '}') depth--;
        i++;
      }
      continue;
    }
    i++;
  }
  return text.length;
};

const skipSpace = (text, index) => {
  let i = index;
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
};

/* Steps over a generic argument list: `<{ url: string }>` between the
   callee and its parenthesis. Returns index unchanged when absent. */
export const skipGeneric = (text, index) => {
  if (text[index] !== '<') return index;
  let depth = 0;
  let i = index;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i);
      continue;
    }
    if (ch === '<') depth++;
    else if (ch === '>') {
      depth--;
      if (depth === 0) return i + 1;
    } else if (ch === ';' && depth === 0) return index;
    i++;
  }
  return index;
};

export const findCallEnd = (text, openParen) => {
  let depth = 0;
  let i = openParen;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i);
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return text.length;
};

/* A plain quoted literal yields its value. A template literal yields the
   path with every interpolation collapsed to the `:*` wildcard, so
   `/api/entries/${id}` still matches the `/api/entries/:id` route. */
const readPathArgument = (text, index) => {
  const quote = text[index];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;
  const end = skipString(text, index);
  const raw = text.slice(index + 1, end - 1);
  if (quote !== '`') return raw;
  return raw.replace(/\$\{[^}]*\}/g, ':*');
};

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

const findCalls = (relFile) => {
  const text = maskComments(read(relFile));
  const hints = [...read(relFile).matchAll(ENDPOINT_HINT_RE)].map(
    (match) => match[1],
  );
  const calls = [];
  const unresolved = [];
  const bound = [...text.matchAll(FETCH_BINDING_RE)].map((match) => match[1]);
  const strict = [...API_CALLERS, ...bound];
  const callee = new RegExp(
    `(?<![\\w$.])(${[...strict, ...LOOSE_CALLERS]
      .map((name) => name.replace('$', '\\$'))
      .join('|')})\\s*`,
    'g',
  );
  for (const match of text.matchAll(callee)) {
    const name = match[1];
    let i = skipSpace(text, match.index + match[0].length);
    i = skipGeneric(text, i);
    i = skipSpace(text, i);
    if (text[i] !== '(') continue;
    const argStart = skipSpace(text, i + 1);
    const literal = readPathArgument(text, argStart);
    if (literal === null) {
      if (strict.includes(name)) {
        unresolved.push({ line: lineAt(text, match.index), callee: name });
      }
      continue;
    }
    if (!literal.startsWith('/api/')) continue;
    // `'/api/entries/' + id` — the literal is a prefix, so the trailing
    // segment is dynamic. Without this the empty tail segment happens to
    // match a `:param` route anyway, which is the right answer for the
    // wrong reason and would mislead on any other shape.
    const literalEnd = skipString(text, argStart);
    const concatenated = text[skipSpace(text, literalEnd)] === '+';
    const path = literal.split('?')[0];
    const args = text.slice(i, findCallEnd(text, i));
    const method = args.match(/\bmethod:\s*['"]([A-Za-z]+)['"]/);
    calls.push({
      path: concatenated && path.endsWith('/') ? `${path}:*` : path,
      method: (method ? method[1] : 'GET').toUpperCase(),
      line: lineAt(text, match.index),
    });
  }
  for (const hint of hints) {
    calls.push({ path: hint, method: 'GET', line: 0, annotated: true });
  }
  // An annotated file states its endpoints explicitly; that is the whole
  // point of the hint, so its unresolved calls stop being findings.
  return { calls, unresolved: hints.length > 0 ? [] : unresolved };
};

/* server/api/entries/[id].get.ts → GET /api/entries/:id */
export const routeFromFile = (relFile) => {
  const withoutExtension = relFile.replace(CODE_EXTENSION_RE, '');
  const segments = withoutExtension.slice('server/'.length).split('/');
  let last = segments.pop();
  let method = 'ALL';
  for (const verb of HTTP_METHODS) {
    if (last.endsWith(`.${verb}`)) {
      method = verb.toUpperCase();
      last = last.slice(0, -(verb.length + 1));
      break;
    }
  }
  if (last !== 'index') segments.push(last);
  const path = segments
    .map((segment) =>
      segment.replace(/^\[\.\.\.(.+)\]$/, '**:$1').replace(/^\[(.+)\]$/, ':$1'),
    )
    .join('/');
  return { method, path: `/${path}` };
};

export const segmentsMatch = (callSegment, routeSegment) => {
  if (routeSegment.startsWith(':') || callSegment === ':*') return true;
  return callSegment === routeSegment;
};

export const matchesRoute = (call, route) => {
  if (route.method !== 'ALL' && route.method !== call.method) return false;
  const callParts = call.path.split('/');
  const routeParts = route.path.split('/');
  if (callParts.length !== routeParts.length) return false;
  return callParts.every((part, index) =>
    segmentsMatch(part, routeParts[index]),
  );
};

/* Named imports of `moduleHint`, minus type-only ones — a type import
   creates no runtime dependency and must not become an edge. */
export const importedNames = (text, moduleHint) => {
  const names = new Set();
  for (const match of text.matchAll(NAMED_IMPORT_RE)) {
    if (match[1]) continue;
    if (!match[3].includes(moduleHint)) continue;
    for (const raw of match[2].split(',')) {
      const name = raw.trim();
      if (name === '' || name.startsWith('type ')) continue;
      names.add(name.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
};

const NAMED_IMPORT_RE =
  /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;

/* Domain operations a file depends on, as `module.operation` ids. A route
   reaches them through the `~/server/domain/x` alias; a domain module
   reaches a sibling through a relative `./x`, which is why the caller's
   own path matters. Counting only routes would report an operation used
   solely by another domain module as uncalled. */
const collectDomainOperations = (text, relFile) => {
  const isDomainFile = relFile.startsWith(`${DOMAIN_ROOT}/`);
  const found = new Set();
  for (const match of text.matchAll(NAMED_IMPORT_RE)) {
    if (match[1]) continue;
    const specifier = match[3];
    let moduleName = null;
    if (specifier.includes(`/${DOMAIN_DIR}/`)) {
      const after = specifier.slice(
        specifier.indexOf(`/${DOMAIN_DIR}/`) + DOMAIN_DIR.length + 2,
      );
      moduleName = after.replace(/\.[jt]s$/, '');
    } else if (isDomainFile && specifier.startsWith('.')) {
      moduleName = specifier.replace(/^\.+\//, '').replace(/\.[jt]s$/, '');
    }
    if (moduleName === null) continue;
    for (const raw of match[2].split(',')) {
      const name = raw.trim();
      if (name === '' || name.startsWith('type ')) continue;
      found.add(`${moduleName}.${name.split(/\s+as\s+/)[0].trim()}`);
    }
  }
  return [...found].sort();
};

const OPERATION_RE =
  /^export\s+(?:const\s+(\w+)\s*=\s*(?:async\s*)?\(|(?:async\s+)?function\s+(\w+))/gm;

const operationsIn = (relFile) => {
  const text = maskComments(read(relFile));
  const names = [];
  for (const match of text.matchAll(OPERATION_RE)) {
    names.push(match[1] ?? match[2]);
  }
  return names;
};

const loadEntities = async () => {
  // Dynamic, not a static top-level import: bun's `node:module` shim has no
  // `registerHooks` export, and a static import of a missing named export
  // fails at link time — before any test code runs — which would make the
  // pure helpers below unimportable from a `bun test` spec. Node resolves
  // this dynamically the same way it would a static import, so the CLI path
  // (`node scripts/capability-graph.js`) is unaffected.
  const { registerHooks } = await import('node:module');
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        const url = new URL(specifier, context.parentURL);
        return next(`${specifier}.ts`, { ...context, url });
      }
      return next(specifier, context);
    },
  });
  const { getTableColumns, is, Table } = await import('drizzle-orm');
  const schema = await import(pathToFileURL(join(ROOT, SCHEMA_ENTRY)).href);
  const entities = [];
  // A positive predicate, not try/catch around getTableColumns: the
  // schema also exports pgEnum builders, for which getTableColumns
  // returns undefined instead of throwing.
  for (const [name, value] of Object.entries(schema)) {
    if (!is(value, Table)) continue;
    entities.push({
      name,
      columns: Object.keys(getTableColumns(value)).sort(),
    });
  }
  return entities.sort((a, b) => a.name.localeCompare(b.name));
};

const buildGraph = async () => {
  const entities = await loadEntities();
  const entityNames = new Set(entities.map((entity) => entity.name));

  const clientFiles = [];
  for (const root of CLIENT_ROOTS) walk(root, clientFiles);
  clientFiles.push(...CLIENT_FILES);
  clientFiles.sort();

  const clients = [];
  for (const relFile of clientFiles) {
    const { calls, unresolved } = findCalls(relFile);
    clients.push({ file: relFile, calls, unresolved });
  }

  const routeFiles = walk(API_ROOT, []).sort();
  const routes = routeFiles.map((relFile) => {
    const source = read(relFile);
    const text = maskComments(source);
    const allow = readAnnotation(source, 'allow-orphan');
    const pendingText = readAnnotation(source, 'pending');
    const ticket = pendingText === null ? null : pendingText.match(TICKET_RE);
    const operations = collectDomainOperations(text, relFile);
    // Transport must not touch the db (ADR-0010), but the grandfathered
    // auth routes still do. Recording those edges keeps the graph honest
    // about where data access actually lives today.
    const legacyEntities = [...importedNames(text, 'db/schema')].filter(
      (name) => entityNames.has(name),
    );
    return {
      ...routeFromFile(relFile),
      file: relFile,
      operations: operations.sort(),
      legacyEntities: legacyEntities.sort(),
      allowOrphan: allow,
      pending: pendingText,
      pendingTicket: ticket === null ? null : ticket[0],
      callers: [],
    };
  });
  routes.sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  );

  const dangling = [];
  for (const client of clients) {
    for (const call of client.calls) {
      const hits = routes.filter((route) => matchesRoute(call, route));
      if (hits.length === 0) {
        dangling.push({ file: client.file, ...call });
        continue;
      }
      for (const hit of hits) hit.callers.push(client.file);
    }
  }
  for (const route of routes) {
    route.callers = [...new Set(route.callers)].sort();
  }

  const modules = [];
  for (const relFile of [...walk(DOMAIN_ROOT, []), ...walk(INFRA_ROOT, [])]) {
    const text = maskComments(read(relFile));
    const used = [...importedNames(text, 'db/schema')].filter((name) =>
      entityNames.has(name),
    );
    const isDomain = relFile.startsWith(`${DOMAIN_ROOT}/`);
    const operations = isDomain ? operationsIn(relFile) : [];
    if (used.length === 0 && operations.length === 0) continue;
    modules.push({
      name: relFile
        .slice(relFile.indexOf('/') + 1)
        .replace(/\.[jt]s$/, '')
        .replace(/^(domain|utils)\//, ''),
      layer: isDomain ? 'domain' : 'infra',
      file: relFile,
      operations: operations.sort(),
      uses: collectDomainOperations(text, relFile),
      entities: used.sort(),
    });
  }
  modules.sort((a, b) =>
    `${a.layer} ${a.name}`.localeCompare(`${b.layer} ${b.name}`),
  );

  // A named import from a domain module is not necessarily an operation
  // (`errors.DomainError` is a class), so keep only ids that a module
  // actually defines.
  const defined = new Set(
    modules.flatMap((module) =>
      module.operations.map((name) => `${module.name}.${name}`),
    ),
  );
  for (const module of modules) {
    module.uses = module.uses.filter((id) => defined.has(id));
  }
  for (const route of routes) {
    route.operations = route.operations.filter((id) => defined.has(id));
  }

  return { clients, routes, modules, entities, dangling };
};

const collectFindings = (graph) => {
  const findings = [];
  for (const route of graph.routes) {
    const declared = route.allowOrphan !== null || route.pending !== null;
    if (route.callers.length === 0 && !declared) {
      findings.push({
        kind: 'ORPHAN ROUTE',
        where: route.file,
        detail:
          `${route.method} ${route.path} has no client caller — wire it, ` +
          'delete it, annotate `graph-allow-orphan: <reason>` when no ' +
          'client ever will, or `graph-pending: VKB-<n> — <reason>` when ' +
          'one is coming',
      });
    }
    if (route.callers.length > 0 && declared) {
      const key = route.allowOrphan !== null ? 'allow-orphan' : 'pending';
      findings.push({
        kind: 'STALE ANNOTATION',
        where: route.file,
        detail:
          `${route.method} ${route.path} now has callers — remove the ` +
          `\`graph-${key}\` annotation`,
      });
    }
    // A pending gap without a ticket is an excuse, not a plan.
    if (route.pending !== null && route.pendingTicket === null) {
      findings.push({
        kind: 'PENDING WITHOUT TICKET',
        where: route.file,
        detail:
          `${route.method} ${route.path} is marked pending but names no ` +
          'VKB-<n> issue — file one or use `graph-allow-orphan`',
      });
    }
    if (route.allowOrphan !== null && route.pending !== null) {
      findings.push({
        kind: 'CONFLICTING ANNOTATION',
        where: route.file,
        detail:
          `${route.method} ${route.path} claims both never-called and ` +
          'pending — keep one',
      });
    }
  }
  for (const call of graph.dangling) {
    findings.push({
      kind: 'DANGLING CALL',
      where: `${call.file}:${call.line}`,
      detail: `${call.method} ${call.path} matches no route file`,
    });
  }
  for (const client of graph.clients) {
    for (const call of client.unresolved) {
      findings.push({
        kind: 'UNRESOLVED CALL',
        where: `${client.file}:${call.line}`,
        detail:
          `${call.callee}() endpoint is not a literal — add a ` +
          '`graph-endpoint: /api/...` annotation to the file',
      });
    }
  }
  // Reachable from anywhere that is not the defining module: a route, a
  // sibling domain module, or an infra helper.
  const called = new Set([
    ...graph.routes.flatMap((route) => route.operations),
    ...graph.modules.flatMap((module) => module.uses),
  ]);
  for (const module of graph.modules) {
    if (module.layer !== 'domain') continue;
    for (const name of module.operations) {
      const id = `${module.name}.${name}`;
      if (!called.has(id)) {
        findings.push({
          kind: 'UNCALLED OPERATION',
          where: module.file,
          detail:
            `${id} is reached by no route, sibling domain module or ` +
            'infra helper',
        });
      }
    }
  }
  const usedEntities = new Set([
    ...graph.modules.flatMap((module) => module.entities),
    ...graph.routes.flatMap((route) => route.legacyEntities),
  ]);
  for (const entity of graph.entities) {
    if (!usedEntities.has(entity.name)) {
      findings.push({
        kind: 'UNREACHED ENTITY',
        where: 'db/schema',
        detail: `${entity.name} is imported by no domain or infra module`,
      });
    }
  }
  return findings.sort((a, b) =>
    `${a.kind} ${a.where}`.localeCompare(`${b.kind} ${b.where}`),
  );
};

const mermaidId = (prefix, value) =>
  `${prefix}_${value.replace(/[^A-Za-z0-9]/g, '_')}`;

const renderMermaid = (graph) => {
  const lines = ['flowchart LR'];
  const wired = graph.routes.filter((route) => route.callers.length > 0);
  const clientFiles = [
    ...new Set(wired.flatMap((route) => route.callers)),
  ].sort();

  lines.push('  subgraph client');
  for (const file of clientFiles) {
    lines.push(`    ${mermaidId('c', file)}["${file}"]`);
  }
  lines.push('  end');

  lines.push('  subgraph transport');
  for (const route of graph.routes) {
    const label = `${route.method} ${route.path}`;
    const shape = route.callers.length === 0 ? `("${label}")` : `["${label}"]`;
    lines.push(`    ${mermaidId('r', label)}${shape}`);
  }
  lines.push('  end');

  lines.push('  subgraph domain');
  for (const module of graph.modules) {
    if (module.layer !== 'domain') continue;
    for (const name of module.operations) {
      const id = `${module.name}.${name}`;
      lines.push(`    ${mermaidId('o', id)}["${id}"]`);
    }
  }
  lines.push('  end');

  lines.push('  subgraph infra');
  for (const module of graph.modules) {
    if (module.layer !== 'infra') continue;
    lines.push(`    ${mermaidId('i', module.name)}["${module.file}"]`);
  }
  lines.push('  end');

  lines.push('  subgraph data');
  for (const entity of graph.entities) {
    lines.push(`    ${mermaidId('e', entity.name)}[("${entity.name}")]`);
  }
  lines.push('  end');

  for (const route of graph.routes) {
    const routeId = mermaidId('r', `${route.method} ${route.path}`);
    for (const caller of route.callers) {
      lines.push(`  ${mermaidId('c', caller)} --> ${routeId}`);
    }
    for (const operation of route.operations) {
      lines.push(`  ${routeId} --> ${mermaidId('o', operation)}`);
    }
    // Dotted: transport reaching a table directly, the legacy shape.
    for (const entity of route.legacyEntities) {
      lines.push(`  ${routeId} -.-> ${mermaidId('e', entity)}`);
    }
  }
  for (const module of graph.modules) {
    for (const entity of module.entities) {
      const target = mermaidId('e', entity);
      if (module.layer !== 'domain') {
        lines.push(`  ${mermaidId('i', module.name)} --> ${target}`);
        continue;
      }
      for (const name of module.operations) {
        const source = mermaidId('o', `${module.name}.${name}`);
        lines.push(`  ${source} --> ${target}`);
      }
    }
  }
  return lines.join('\n');
};

const renderMarkdown = (graph, findings) => {
  const out = [];
  out.push('# Capability graph');
  out.push('');
  out.push(
    'Generated by `bun run graph:build` — **do not edit by hand**. Read it',
    'when scoping a ticket: it says which screens reach which endpoints,',
    'which domain operations they run, and which entity columns exist. CI',
    'runs `bun run graph:check` to keep it honest.',
  );
  out.push('');

  out.push('## Findings');
  out.push('');
  if (findings.length === 0) {
    out.push('None — every route has a caller and every call resolves.');
  } else {
    out.push('| Kind | Where | Detail |');
    out.push('| --- | --- | --- |');
    for (const finding of findings) {
      out.push(
        `| ${finding.kind} | \`${finding.where}\` | ${finding.detail} |`,
      );
    }
  }
  out.push('');

  out.push('## Wiring');
  out.push('');
  out.push('| Route | Callers | Domain operations |');
  out.push('| --- | --- | --- |');
  for (const route of graph.routes) {
    const callers =
      route.callers.length > 0
        ? route.callers.map((file) => `\`${file}\``).join('<br>')
        : route.allowOrphan !== null
          ? `_none — ${route.allowOrphan}_`
          : route.pendingTicket !== null
            ? `_none yet — ${route.pendingTicket}_`
            : '**none**';
    const legacy = route.legacyEntities.map((name) => `\`${name}\``).join(', ');
    const operations =
      route.operations.length > 0
        ? route.operations.map((name) => `\`${name}\``).join('<br>')
        : route.legacyEntities.length > 0
          ? `_direct db (ADR-0010 legacy):_ ${legacy}`
          : '_inline_';
    out.push(
      `| \`${route.method} ${route.path}\` | ${callers} | ${operations} |`,
    );
  }
  out.push('');
  out.push(
    'Routes marked _direct db_ reach tables from transport instead of a',
    'domain operation. They are the grandfathered set in',
    '`scripts/layering-check.js`; the list only shrinks.',
  );
  out.push('');

  const pending = graph.routes.filter(
    (route) => route.pending !== null && route.callers.length === 0,
  );
  if (pending.length > 0) {
    out.push('## Pending wiring');
    out.push('');
    out.push(
      'Real gaps with a ticket: the endpoint exists, the screen that will',
      'call it does not. Kept out of Findings so a NEW gap stands out —',
      'not hidden. Wiring one makes its annotation stale, which is a',
      'finding, so the note cannot outlive the gap.',
    );
    out.push('');
    out.push('| Route | Tracked by | Note |');
    out.push('| --- | --- | --- |');
    for (const route of pending) {
      const note = route.pending
        .replace(TICKET_RE, '')
        .replace(/^\s*[—-]\s*/, '')
        .trim();
      out.push(
        `| \`${route.method} ${route.path}\` | ` +
          `${route.pendingTicket ?? '**no ticket**'} | ${note} |`,
      );
    }
    out.push('');
  }

  out.push('## Client surfaces without API calls');
  out.push('');
  out.push(
    'Informational, not a finding — a surface may be static by design or a',
    'placeholder awaiting its ticket.',
  );
  out.push('');
  for (const client of graph.clients) {
    if (client.calls.length === 0) out.push(`- \`${client.file}\``);
  }
  out.push('');

  out.push('## Domain and infra modules');
  out.push('');
  out.push('| Module | Layer | Operations | Entities | Calls |');
  out.push('| --- | --- | --- | --- | --- |');
  for (const module of graph.modules) {
    const operations =
      module.operations.length > 0
        ? module.operations.map((name) => `\`${name}\``).join('<br>')
        : '—';
    const entities =
      module.entities.length > 0
        ? module.entities.map((name) => `\`${name}\``).join(', ')
        : '—';
    const uses =
      module.uses.length > 0
        ? module.uses.map((id) => `\`${id}\``).join('<br>')
        : '—';
    out.push(
      `| \`${module.file}\` | ${module.layer} | ${operations} | ` +
        `${entities} | ${uses} |`,
    );
  }
  out.push('');

  out.push('## Entities');
  out.push('');
  for (const entity of graph.entities) {
    out.push(`### \`${entity.name}\``);
    out.push('');
    out.push(entity.columns.map((column) => `\`${column}\``).join(', '));
    out.push('');
  }

  out.push('## Diagram');
  out.push('');
  out.push('Rounded transport nodes have no client caller.');
  out.push('');
  out.push('```mermaid');
  out.push(renderMermaid(graph));
  out.push('```');
  out.push('');
  return out.join('\n');
};

const main = async () => {
  const mode = process.argv[2] ?? 'build';
  if (mode !== 'build' && mode !== 'check') {
    console.error(`capability-graph: unknown mode "${mode}"`);
    process.exit(1);
  }

  let graph;
  try {
    graph = await buildGraph();
  } catch (error) {
    console.error(
      'capability-graph: failed to build the graph — the schema import is ' +
        'the usual cause, and a graph without columns would be worse than ' +
        'no graph at all:',
    );
    console.error(`  ${error.message}`);
    process.exit(1);
  }

  const findings = collectFindings(graph);
  const markdown = renderMarkdown(graph, findings);

  if (mode === 'build') {
    writeFileSync(join(ROOT, OUTPUT), markdown);
    console.log(
      `capability-graph: wrote ${OUTPUT} — ${graph.routes.length} route(s), ` +
        `${graph.entities.length} entities, ${findings.length} finding(s)`,
    );
    for (const finding of findings) {
      console.log(`  ${finding.kind}  ${finding.where} — ${finding.detail}`);
    }
    return;
  }

  let committed = null;
  try {
    committed = read(OUTPUT);
  } catch {
    console.error(
      `capability-graph: ${OUTPUT} is missing — run \`bun run graph:build\``,
    );
    process.exit(1);
  }
  if (committed !== markdown) {
    console.error(
      `capability-graph: ${OUTPUT} is stale — run \`bun run graph:build\` ` +
        'and commit the result',
    );
    process.exit(1);
  }
  console.log(
    `capability-graph: ${OUTPUT} current — ${graph.routes.length} route(s), ` +
      `${findings.length} finding(s)`,
  );
};

/* Importing the module for its pure helpers (unit tests) must not trigger
   the CLI — only running it directly, `node scripts/capability-graph.js
   [build|check]`, does. */
const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) await main();
