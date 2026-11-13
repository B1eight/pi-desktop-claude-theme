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
  ok(Buffer.byteLength(css) <= 65000, `${mode}: visual CSS target`);
  const clean = stripComments(css);
  ok(!clean.includes('__SCOPE__') && !clean.includes('@import'), `${mode}: expanded, no imports`);
  ok(!/url\(["']?(?:https?:|file:|[a-z]:)/i.test(clean), `${mode}: no network/absolute asset paths`);
  assert.equal([...clean.matchAll(/url\(/g)].length, 0, `${mode}: no external or embedded asset URLs`); checks++;
  const defs = new Set([...clean.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  for (const m of clean.matchAll(/var\((--[\w-]+)/g)) ok(defs.has(m[1]) || ['--font-scale', '--composer-dock-height'].includes(m[1]), `Defined or measured host token ${m[1]}`);
  for (const { selector } of expandRules(compact(css))) {
    if (selector.startsWith('@')) continue;
    ok(selector.startsWith(scope(mode)), `${mode}: expanded scoped rule ${selector.slice(0, 100)}`);
  }
  /* The host token layer is bridged deliberately: its ten radius steps are compressed onto
   * one grid so surfaces the theme never names share the same ladder. Every bridged value
   * must be present and correct; --radius-full/--radius-round stay untouched. */
  const bridge = { '3xs': 6, '2xs': 7, xs: 8, sm: 9, md: 10, 'md-plus': 11, lg: 12, 'lg-plus': 13, xl: 14, '2xl': 16 };
  for (const [step, px] of Object.entries(bridge)) ok(clean.includes(`--radius-${step}:${px}px`) || clean.includes(`--radius-${step}: ${px}px`), `${mode}: host radius ${step} bridged to ${px}px`);
  ok(!/--radius-(?:full|round)\s*:/.test(clean), 'Host shape radii left to the host');
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
    ['--ds-text-muted', '--ds-bg-elevated-opaque'], ['--at-cds-action-fg', '--at-cds-action-bg'],
    ['--at-cds-action-fg', '--at-cds-action-hover'],
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
ok(contrast(parseColor('#383a42'), parseColor('#f4f2ec')) >= 4.5, 'Plain code contrast');
ok(contrast(parseColor('#151514'), parseColor('#f0eee9')) >= 4.5, 'Light user bubble contrast');
ok(contrast(parseColor('#f5f4f0'), parseColor('#20201e')) >= 4.5, 'Dark user bubble contrast');
const expectedLight = {
  '--ds-bg-primary': '#fcfcfb', '--ds-bg-under': '#fcfcfb',
  '--ds-bg-sidebar': '#f9f9f7', '--ds-settings-rail-bg': '#fcfcfb', '--ds-sidebar-glass-tint': '#f9f9f7',
  '--ds-bg-secondary': '#fcfcfb', '--ds-bg-dock': '#fcfcfb', '--ds-bg-tertiary': '#f0efec',
  '--ds-code-head-bg': '#f4f2ec', '--ds-code-hover-bg': '#e8e8e2', '--ds-thinking-code-bg': '#f4f2ec',
  '--at-cds-user-bg': '#f0eee9', '--at-cds-inline-code-bg': '#efefee', '--at-cds-code-bg': '#f4f2ec',
  '--ds-bg-composer': 'rgba(255, 255, 255, .5)', '--ds-bg-elevated-opaque': '#ffffff', '--at-cds-surface': '#fafafa',
};
const expectedDark = {
  '--ds-bg-primary': '#191815', '--ds-bg-under': '#191815',
  '--ds-bg-sidebar': '#151411', '--ds-settings-rail-bg': '#191815', '--ds-sidebar-glass-tint': '#151411',
  '--ds-bg-secondary': '#191815', '--ds-bg-dock': '#191815', '--ds-bg-tertiary': '#1d1c19',
  '--ds-code-head-bg': '#0d0d0c', '--ds-code-hover-bg': '#292927', '--ds-thinking-code-bg': '#0d0d0c',
  '--at-cds-user-bg': '#20201e', '--at-cds-inline-code-bg': '#292827', '--at-cds-code-bg': '#0d0d0c',
  '--ds-bg-composer': 'rgba(255, 255, 255, .05)', '--ds-bg-elevated-opaque': '#222220', '--at-cds-surface': '#1a1a19',
};
for (const [token, value] of Object.entries(expectedLight)) ok(resolvedPalette('light').get(token) === value, `Expected light token ${token}`);
for (const [token, value] of Object.entries(expectedDark)) ok(resolvedPalette('dark').get(token) === value, `Expected dark token ${token}`);
ok(palette('light').get('--ds-text-primary') === '#151514' && palette('dark').get('--ds-text-primary') === '#f5f4f0', 'Primary text uses approved mode values');
ok(palette('light').get('--ds-text-secondary') === '#52514c' && palette('dark').get('--ds-text-secondary') === '#c2c0b8', 'Secondary text uses approved mode values');
ok(palette('light').get('--ds-text-muted') === '#75746d' && palette('dark').get('--ds-text-muted') === '#96948d', 'Muted text uses approved mode values');
ok(palette('light').get('--ds-text-faint') === '#94928b' && palette('dark').get('--ds-text-faint') === '#6e6d68', 'Faint text uses approved mode values');
ok(palette('light').get('--ds-placeholder-ink') === '#94928b' && palette('dark').get('--ds-placeholder-ink') === '#6e6d68', 'Placeholder uses approved mode values');
for (const mode of ['light', 'dark']) {
  const vars = palette(mode);
  const raw = token => vars.get(token).replace(/^var\((--[\w-]+)\)$/, (_, referenced) => vars.get(referenced));
  const page = parseColor(raw('--ds-bg-primary'));
  const composer = parseColor(raw('--ds-bg-composer'));
  const composed = composer[3] < 1 ? compositeOver(composer, page) : composer;
  const faintRatio = contrast(parseColor(raw('--ds-text-faint')), page);
  const placeholderRatio = contrast(parseColor(raw('--ds-placeholder-ink')), composed);
  ok(faintRatio >= 2.8 && faintRatio <= 3.6, `${mode}: faint/page visual ratio ${faintRatio.toFixed(2)} in 2.8-3.6`);
  ok(placeholderRatio >= 2.8 && placeholderRatio <= 3.6, `${mode}: placeholder/composer visual ratio ${placeholderRatio.toFixed(2)} in 2.8-3.6`);
  ok(Math.abs(luminance(parseColor(raw('--ds-text-muted'))) - luminance(parseColor(raw('--ds-text-faint')))) >= .10, `${mode}: muted/faint luminance separation`);
}
ok(palette('light').get('--at-cds-user-bg') === '#f0eee9' && palette('dark').get('--at-cds-user-bg') === '#20201e', 'User bubble surfaces use approved mode values');
ok(palette('light').get('--at-cds-clay-ink') === '#bd562f' && palette('dark').get('--at-cds-clay-ink') === '#d97757', 'Clay ink values');
ok(palette('light').get('--at-cds-clay-vivid') === '#d97757' && palette('dark').get('--at-cds-clay-vivid') === '#cc6b49', 'Clay vivid values');
/* I4：陶土只用于品牌与运行态。聚焦环是中性强调，不能借陶土；拖放目标才是动作态。 */
ok(!String(palette('light').get('--at-cds-composer-focus')).includes('clay') && !String(palette('dark').get('--at-cds-composer-focus')).includes('clay'), 'Composer focus ring stays neutral');
ok(String(palette('light').get('--at-cds-composer-drop')).includes('--at-cds-clay-vivid') && String(palette('dark').get('--at-cds-composer-drop')).includes('--at-cds-clay-vivid'), 'Composer drop target keeps the clay affordance');
const components = read('src/components.css');
ok(components.includes('font-weight: var(--at-cds-w-regular)') && components.includes('--at-cds-w-regular: 400;') && !palette('dark').has('--at-cds-body-weight'), 'Both modes use genuine static regular prose');
const sansStack = '--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", system-ui, "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;';
const proseStack = '--font-prose: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;';
ok(components.includes(sansStack) && components.includes(proseStack) && components.includes('--font-serif: var(--font-prose)') && components.includes('--font-mono: "Cascadia Code"'), 'Approved system UI, prose, mono stacks and serif alias; no packaged fonts');
ok(components.includes('.prose-chat {\n  font-family: var(--font-prose);') && components.includes('font-family: var(--font-prose); font-weight: var(--at-cds-w-semibold)'), 'Prose and headings use the reading family');
ok(components.includes('--at-cds-body-leading: 1.68;') && components.includes('.prose-chat p { margin: .85em 0; }'), 'Prose line height and paragraph rhythm');
ok(components.includes('--at-cds-r-bubble: 14px;') && components.includes('--at-cds-r-dialog: 10px;') && ['light', 'dark'].every(mode => palette(mode).get('--ds-composer-radius') === '12px'), 'Composer, bubble and dialog radii');
ok(components.includes('--at-cds-r-sm: 6px;') && components.includes('--at-cds-r-md: 7px;') && components.includes('--at-cds-r-lg: 10px;') && components.includes('--at-cds-r-xl: 12px;'), 'Existing radius scale preserved');
ok(components.includes('--at-cds-ease-out-expo: cubic-bezier(.16, 1, .3, 1)') && components.includes('--at-cds-spring-snappy: var(--at-cds-ease-out-expo)') && components.includes('--at-cds-t-press: 70ms'), 'Motion tokens installed');
ok(/linear\(0,\s*\.45 14%,\s*\.82 29%,\s*1\.01 44%,\s*1\.05 56%,\s*1\.02 74%,\s*1\)/.test(components), 'Progressive spring easing supported');
ok(read('src/palette.dark.css').includes('font-smoothing: antialiased') || /data-theme="dark"[\s\S]*?font-smoothing: antialiased/.test(components), 'Dark mode declares local font smoothing');
ok(!components.includes('@font-face') && !themeRead('light').includes('@font-face') && !themeRead('dark').includes('@font-face'), 'No @font-face declarations; every family is installed locally');
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
const workpanelGeometry = stripComments(workpanel)
  .replaceAll('padding-left: 1px;', '')   // 发丝线内衬
  .replaceAll('height: 36px;', '')        // 批准的 36px 标签条（I11）
  .replaceAll('padding: 12px;', '');      // 批准的正文留白（I9）
ok(workpanel.includes('box-sizing: border-box; padding-left: 1px;') && !/(?:^|[;{])\s*(?:width|height|min-width|max-width|flex|position|z-index|padding(?:-[a-z]+)?|margin|animation|transform|fill)\s*:/.test(workpanelGeometry), 'Only the seam, the 36px tab row and the 12px body gutter are authored; other geometry/chrome/motion preserved');
ok(!/\.md-|file-tree|work-panel-resize/.test(stripComments(workpanel)), 'No plugin internals, tree semantics or resize override');
for (const name of ['loading', 'settings', 'workpanel']) ok(sourceBlock(name).includes('__SCOPE__'), `Shared ${name} remains scoped`);
for (const mode of ['light', 'dark']) {
  const vars = palette(mode);
  ok(vars.get('--at-cds-brand') === '#d97757', `${mode}: distinct terracotta brand token`);
  ok(vars.get('--at-cds-action-bg') === (mode === 'light' ? '#0b0b0b' : '#f0efec'), `${mode}: ordinary primary action is neutral`);
  ok(vars.get('--at-cds-action-bg') !== vars.get('--at-cds-brand'), `${mode}: brand and action are separate roles`);
  ok(vars.get('--at-cds-focus-shadow') === 'none', `${mode}: no extra focus shadow`);
  ok(vars.get('--at-cds-control-neutral') !== vars.get('--at-cds-brand'), `${mode}: inactive controls remain neutral`);
  ok(vars.get('--at-cds-functional-selection') === (mode === 'light' ? '#2674cf' : '#397ed4'), `${mode}: functional selection retains its own color`);
  const roles = fs.readFileSync(path.join(root, 'scripts/check-color-roles.mjs'), 'utf8');
  ok(/color role matrix/i.test(roles), `${mode}: role assertions installed`);
}
console.log(`PASS: ${checks} assertions. ${sanitizer ? 'Actual host sanitizer tested.' : 'Host sanitizer not supplied.'}`);
