import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { root, id, renderTheme, scope } from './build.mjs';
import { compact, expandRules } from './css-structure.mjs';

const args = process.argv.slice(2);
const arg = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
let checks = 0;
function ok(condition, message) { assert.ok(condition, message); checks++; }
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const themeRead=mode=>fs.readFileSync(path.join(arg('--theme-dir')||path.join(root,'themes'),`claude-${mode}.css`),'utf8');
const manifest = JSON.parse(read('manifest.json'));
ok(manifest.id === id, 'Plugin identity');
ok(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version), 'Valid release version');
const packageMetadata = JSON.parse(read('package.json'));
ok(packageMetadata.version === manifest.version, 'package.json and manifest release versions agree');
assert.deepEqual(manifest.permissions, ['ui.theme']); checks++;
assert.deepEqual(Object.keys(manifest.contributes), ['themes']); checks++;
ok(manifest.engines.piDesktop === '>=0.20.1', 'Documented host floor');
ok(manifest.contributes.themes.length === 2, 'Two themes');
ok(!/[A-Za-z0-9+/]{2000,}/.test(read('themes/claude-light.css').replace(/\/\*[\s\S]*?\*\//g, '')), 'No embedded binary payload in published theme');
ok(read('LICENSE').includes('Caho1'), 'Reference attribution');
const entries = { exports: {} };
vm.runInNewContext(read('main.js'), { module: entries }, { timeout: 1000 });
assert.deepEqual(Object.keys(entries.exports).sort(), ['onLoad', 'onUnload']); checks++;
await entries.exports.onLoad(); await entries.exports.onUnload(); checks += 2;

let sanitizer;
const hostBundle = arg('--host-bundle');
if (hostBundle) {
  const source = fs.readFileSync(hostBundle, 'utf8');
  const start = source.indexOf('const THEME_CSS_MAX_BYTES =');
  const end = source.indexOf('const VARIABLE_NAME =', start);
  ok(start >= 0 && end > start, 'Host sanitizer boundaries found');
  sanitizer = vm.runInNewContext(source.slice(start, end) + '\n({sanitizeThemeCss, normalizeThemeAssetPath, themeAssetUrl})', { TextEncoder }, { timeout: 1000 });
}
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const palette = mode => new Map([...read(`src/palette.${mode}.css`).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
// Resolve one level of var(--token) so semantic slots can reference the neutral ladder.
const resolvedPalette = mode => {
  const raw = palette(mode);
  const out = new Map();
  for (const [k, v] of raw) {
    const m = v.match(/^var\((--[\w-]+)\)$/);
    out.set(k, m ? (raw.get(m[1]) ?? v) : v);
  }
  return out;
};
assert.deepEqual([...palette('light').keys()].sort(), [...palette('dark').keys()].sort()); checks++;
for (const mode of ['light', 'dark']) {
  const declaration = manifest.contributes.themes.find(t => t.base === mode);
  ok(declaration?.id === `claude-${mode}`, 'Theme ID/base mapping');
  ok(!Object.hasOwn(declaration, 'assets'), 'No installer-rejected package-relative assets');
  const css = themeRead(mode);
  ok(css === renderTheme(mode), `${mode}: generated file is current`);
  ok(Buffer.byteLength(css) <= 256 * 1024, `${mode}: CSS budget`);
  const clean = stripComments(css);
  ok(!clean.includes('__SCOPE__') && !clean.includes('@import'), `${mode}: expanded, no imports`);
  ok(!/url\(["']?(?:https?:|file:|[a-z]:)/i.test(clean), `${mode}: no network/absolute asset paths`);
  assert.equal([...clean.matchAll(/url\(/g)].length, 0, `${mode}: no external or embedded asset URLs`); checks++;
  const defs = new Set([...clean.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  for (const m of clean.matchAll(/var\((--[\w-]+)/g)) ok(defs.has(m[1]) || m[1] === '--font-scale', `Defined token ${m[1]}`);
  for (const { selector } of expandRules(compact(css))) {
    if (selector.startsWith('@')) continue;
    ok(selector.startsWith(scope(mode)), `${mode}: expanded scoped rule ${selector.slice(0, 100)}`);
  }
  ok(!/--radius-(?:xs|sm|md|lg|xl)\s*:/.test(clean), 'No host global radius reset');
  ok(/prefers-reduced-motion:\s*reduce/.test(clean) && /forced-colors:\s*active/.test(clean), 'Accessibility fallbacks');
  if (sanitizer) {
    const result = sanitizer.sanitizeThemeCss(css, 256 * 1024);
    ok(result.ok, `${mode}: actual host sanitizer: ${result.error || 'accepted'}`);
    ok(result.css === css.trim(), 'Sanitizer preserves all styling');
    ok(!sanitizer.sanitizeThemeCss('@import "https://example.invalid/x.css";').ok, 'Sanitizer negative control');
    ok(!sanitizer.sanitizeThemeCss('a { background: url("missing.woff2"); }').ok, 'Undeclared asset rejected');
  }
  console.log(`${mode}: ${Buffer.byteLength(css)} CSS bytes, ${defs.size} variables`);
}

// Parse #rgb / #rrggbb / rgba(r,g,b,a) and composite any translucent colour onto the
// page background before measuring, so a semi-transparent fill is judged by what the
// user actually sees rather than by its raw declared value.
function parseColor(value) {
  const s = String(value || '').trim();
  const short = s.match(/^#([0-9a-f]{3})$/i);
  if (short) return [...short[1].split('').map(c => parseInt(c + c, 16)), 1];
  const long = s.match(/^#([0-9a-f]{6})$/i);
  if (long) return [parseInt(long[1].slice(0, 2), 16), parseInt(long[1].slice(2, 4), 16), parseInt(long[1].slice(4, 6), 16), 1];
  const fn = s.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1].split(',').map(x => parseFloat(x.trim()));
    if (parts.length >= 3) return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  return null;
}
function compositeOver(fg, bg) {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}
function luminance(rgba) {
  const rgb = rgba.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(fg, bg) { const [a, b] = [luminance(fg), luminance(bg)].sort((a, b) => b - a); return (a + .05) / (b + .05); }
for (const mode of ['light', 'dark']) {
  const vars = palette(mode);
  for (const [fg, bg] of [
    ['--ds-text-primary', '--ds-bg-primary'], ['--ds-text-secondary', '--ds-bg-primary'],
    ['--ds-text-muted', '--ds-bg-elevated-opaque'], ['--ds-placeholder-ink', '--ds-bg-composer'],
    ['--at-cds-action-fg', '--at-cds-action-bg'], ['--at-cds-action-fg', '--at-cds-action-hover'],
    ['--at-cds-selection-fg', '--at-cds-selection-bg'], ['--at-cds-link', '--ds-bg-primary'],
    ['--ds-info', '--ds-bg-primary'], ['--at-cds-status-neutral', '--ds-bg-composer'],
    ['--at-cds-inline-fg', '--at-cds-inline-code-bg'], ['--ds-focus', '--ds-bg-composer'],
  ]) {
    const raw = token => vars.get(token).replace(/^var\((--[\w-]+)\)$/, (_, referenced) => vars.get(referenced));
    // Composite any translucent colour over the page so the ratio reflects what renders.
    const page = parseColor(raw('--ds-bg-primary')) ?? [255, 255, 255, 1];
    const paint = token => {
      const c = parseColor(raw(token));
      if (!c) return null;
      return c[3] < 1 ? compositeOver(c, page) : c;
    };
    const fgC = paint(fg), bgC = paint(bg);
    ok(fgC && bgC, `${mode} ${fg}/${bg}: unparsable colour`);
    const ratio = contrast(fgC, bgC);
    ok(ratio >= 4.5, `${mode} ${fg}/${bg}: ${ratio.toFixed(2)} < 4.5`);
    console.log(`contrast ${mode} ${fg}: ${ratio.toFixed(2)}:1`);
  }
}
ok(contrast(parseColor('#8e2626'), parseColor('#efefee')) >= 4.5, 'Independent red inline code contrast');
ok(contrast(parseColor('#383a42'), parseColor('#fafafa')) >= 4.5, 'Plain code contrast');
ok(contrast(parseColor('#151515'), parseColor('#f0f0ee')) >= 4.5, 'User bubble contrast');
const expectedLight = {
  '--ds-bg-primary': '#fcfcfb', '--ds-bg-under': '#fcfcfb',
  '--ds-bg-sidebar': '#fafaf9', '--ds-settings-rail-bg': '#fcfcfb', '--ds-sidebar-glass-tint': '#fafaf9',
  '--ds-bg-secondary': '#fcfcfb', '--ds-bg-dock': '#fcfcfb', '--ds-bg-tertiary': '#f0f0ee',
  '--ds-code-head-bg': '#fdfdfd', '--ds-code-hover-bg': '#e8e8e2', '--ds-thinking-code-bg': '#fafafa',
  '--at-cds-user-bg': '#f0f0ee', '--at-cds-inline-code-bg': '#efefee',
  '--ds-bg-composer': 'rgba(255, 255, 255, .5)', '--ds-bg-elevated-opaque': '#ffffff', '--at-cds-surface': '#fafafa',
};
for (const [token, value] of Object.entries(expectedLight)) ok(resolvedPalette('light').get(token) === value, `Expected light token ${token}`);
ok(palette('light').get('--ds-text-muted') === '#707069' && palette('dark').get('--ds-text-muted') === '#96948d', 'Muted text uses contrast-safe near-reference values');
ok(read('src/components.css').includes('font-weight: var(--at-cds-w-regular)') && read('src/components.css').includes('--at-cds-w-regular: 400;') && !palette('dark').has('--at-cds-body-weight'), 'Both modes use genuine static regular prose');
const sansStack = '--font-sans: "Segoe UI", "Noto Sans SC", system-ui, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;';
ok(read('src/components.css').includes(sansStack) && read('src/components.css').includes('--font-mono: "Cascadia Code"'), 'System typography stack, no packaged fonts');
ok(!read('src/components.css').includes('@font-face') && !themeRead('light').includes('@font-face') && !themeRead('dark').includes('@font-face'), 'No @font-face declarations; every family is installed locally');
for (const mode of ['light', 'dark']) { const p = palette(mode); ok(contrast(parseColor(p.get('--ds-text-primary')), parseColor(p.get('--at-cds-user-bg'))) >= 4.5, `${mode}: user bubble contrast >= 4.5`); }
const refinements = read('src/refinements.css');
const settingsOverrides = read('src/settings.css');
const sharedTail = mode => {
  const css = themeRead(mode);
  return JSON.stringify(expandRules(compact(css)).filter(r => !r.selector.startsWith('@font-face') && !r.body.startsWith('color-scheme:')).map(r => ({ ...r, selector: r.selector.replaceAll(scope(mode), '__SCOPE__') })));
};
ok(sharedTail('light').includes('__SCOPE__') && sharedTail('light').includes('--font-sans:'), 'Shared rules located');
ok(sharedTail('light') === sharedTail('dark'), 'Both modes have exactly identical component/refinement/settings rules');
ok(!themeRead('light').includes('span[style*="color:"]'), 'No forced syntax foreground reset');
const sourceBlock = name => {
  const source = name === 'settings' ? settingsOverrides : refinements;
  const start = source.indexOf(`/* BEGIN block-${name}`);
  const end = source.indexOf(`/* END block-${name} */`, start);
  ok(start >= 0 && end > start, `Independent ${name} block`);
  return source.slice(start, end);
};
const loading = sourceBlock('loading');
for (const phase of ['waiting-model', 'starting', 'preparing', 'compacting', 'retrying', 'recovering', 'waiting-subagents']) ok(loading.includes(`[data-phase="${phase}"]`), `Loading phase ${phase}`);
ok(loading.includes('.working-indicator:not(.run-activity-indicator)'), 'Ordinary loading kept separate');
ok(!/animation|transition|opacity|transform/.test(stripComments(loading)), 'Loading block leaves motion untouched');
ok(loading.includes('.working-elapsed { color: var(--ds-text-muted); }'), 'Elapsed label remains muted');
const settings = sourceBlock('settings');
ok(!settings.includes(':has(.settings-theme-trigger)'), 'Settings shell independent of appearance route');
ok(settings.includes('> .settings-row + .settings-row'), 'Only direct form rows divided');
const settingsRailRule = '__SCOPE__ .settings-shell .settings-nav { background: var(--ds-settings-rail-bg); }';
ok(settings.includes(settingsRailRule), 'Authorized settings-only rail background');
ok(!/overflow:\s*hidden|position:|z-index:|settings-nav/.test(stripComments(settings).replace(settingsRailRule, '')), 'No clipping, fake modal or other rail changes');
ok(settings.includes(':not(:has(> :not(.settings-row)))'), 'Mixed/complex panels retain host gaps');
const workpanel = sourceBlock('workpanel');
ok(workpanel.includes('svg[fill="none"][stroke="currentColor"]'), 'Only verified host line icons adapted');
ok(workpanel.includes('box-sizing: border-box; padding-left: 1px;') && !/(?:^|[;{])\s*(?:width|height|min-width|max-width|flex|position|z-index|padding(?:-[a-z]+)?|margin|animation|transform|fill)\s*:/.test(stripComments(workpanel).replace('padding-left: 1px;', '')), 'Only authorized 1px internal seam reserve; other geometry/chrome/motion preserved');
ok(!/\.md-|file-tree|work-panel-resize/.test(stripComments(workpanel)), 'No plugin internals, tree semantics or resize override');
for (const name of ['loading', 'settings', 'workpanel']) ok(sourceBlock(name).includes('__SCOPE__'), `Shared ${name} remains scoped`);
for (const mode of ['light', 'dark']) {
  const vars = palette(mode);
  ok(vars.get('--at-cds-brand') === '#d97757', `${mode}: distinct terracotta brand token`);
  ok(vars.get('--at-cds-action-bg') === (mode === 'light' ? '#0b0b0b' : '#f0efec'), `${mode}: ordinary primary action is neutral`);
  ok(vars.get('--at-cds-action-bg') !== vars.get('--at-cds-brand'), `${mode}: brand and action are separate roles`);
  ok(vars.get('--at-cds-focus-shadow') === 'none', `${mode}: no extra focus shadow`);
  ok(vars.get('--at-cds-control-neutral') !== vars.get('--at-cds-brand'), `${mode}: inactive controls remain neutral`);
  const roles = fs.readFileSync(path.join(root, 'scripts/check-color-roles.mjs'), 'utf8');
  ok(/color role matrix/i.test(roles), `${mode}: role assertions installed`);
}
console.log(`PASS: ${checks} assertions. ${sanitizer ? 'Actual host sanitizer tested.' : 'Host sanitizer not supplied.'}`);
