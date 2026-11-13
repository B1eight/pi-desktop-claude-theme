import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './build.mjs';
import { compact, expandRules, splitSelectors } from './css-structure.mjs';

/* Color role matrix: semantic roles stay separate even when a clay value matches brand. */

const args = process.argv.slice(2);
const arg = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const modes = ['light', 'dark'];
const checks = [];
const expect = (pass, label) => {
  if (!pass) throw Error(label);
  checks.push(label);
};
const palette = mode => new Map([...read(`src/palette.${mode}.css`).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));

function parseColor(value) {
  const text = String(value || '').trim();
  const short = text.match(/^#([0-9a-f]{3})$/i);
  if (short) return [...short[1]].map(char => parseInt(char + char, 16)).concat(1);
  const long = text.match(/^#([0-9a-f]{6})$/i);
  if (long) return [0, 2, 4].map(offset => parseInt(long[1].slice(offset, offset + 2), 16)).concat(1);
  const fn = text.match(/^rgba?\(([^)]+)\)$/i);
  if (!fn) return null;
  const parts = fn[1].split(',').map(part => parseFloat(part.trim()));
  return parts.length >= 3 ? [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1] : null;
}
function composite(foreground, background) {
  const alpha = foreground[3];
  return [0, 1, 2].map(index => foreground[index] * alpha + background[index] * (1 - alpha)).concat(1);
}
function luminance(color) {
  const channels = color.slice(0, 3).map(channel => channel / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + .05) / (low + .05);
}
function resolve(tokens, name) {
  const value = tokens.get(name);
  const variable = value?.match(/^var\((--[\w-]+)\)$/);
  return variable ? tokens.get(variable[1]) : value;
}
function paint(tokens, name, base) {
  const color = parseColor(resolve(tokens, name));
  return color ? (color[3] < 1 ? composite(color, base) : color) : null;
}
function finalDeclaration(rules, selector, property) {
  let value;
  for (const rule of rules) {
    if (!splitSelectors(rule.selector).includes(selector)) continue;
    for (const declaration of rule.body.split(';')) {
      const match = declaration.match(/^\s*([\w-]+)\s*:\s*([\s\S]*?)\s*$/);
      if (match?.[1] === property) value = match[2].replace(/\s*!important\s*$/, '').trim();
    }
  }
  return value;
}

const ratios = [];
for (const mode of modes) {
  const tokens = palette(mode);
  const expected = mode === 'light' ? {
    '--ds-bg-primary': '#fcfcfb', '--ds-text-primary': '#151514', '--ds-text-secondary': '#52514c',
    '--ds-text-muted': '#75746d', '--ds-text-faint': '#94928b', '--ds-placeholder-ink': '#94928b',
    '--at-cds-user-bg': '#f0eee9', '--ds-code-head-bg': '#f4f2ec', '--at-cds-code-bg': '#f4f2ec',
    '--at-cds-clay-ink': '#bd562f', '--at-cds-clay-vivid': '#d97757', '--at-cds-brand': '#d97757',
  } : {
    '--ds-bg-primary': '#191815', '--ds-text-primary': '#f5f4f0', '--ds-text-secondary': '#c2c0b8',
    '--ds-text-muted': '#96948d', '--ds-text-faint': '#6e6d68', '--ds-placeholder-ink': '#6e6d68',
    '--at-cds-user-bg': '#20201e', '--ds-code-head-bg': '#0d0d0c', '--at-cds-code-bg': '#0d0d0c',
    '--at-cds-clay-ink': '#d97757', '--at-cds-clay-vivid': '#cc6b49', '--at-cds-brand': '#d97757',
  };
  for (const [token, value] of Object.entries(expected)) expect(resolve(tokens, token) === value, `${mode}/${token} expected ${value}`);
  expect(tokens.get('--at-cds-functional-selection') === (mode === 'light' ? '#2674cf' : '#397ed4'), `${mode}/functional selection remains independent`);
  expect(tokens.get('--at-cds-action-bg') !== tokens.get('--at-cds-brand'), `${mode}/neutral primary action differs from brand`);
  expect(new Set(['--at-cds-action-bg', '--at-cds-brand', '--at-cds-functional-selection', '--at-cds-inline-fg', '--ds-error'].map(token => resolve(tokens, token))).size === 5, `${mode}/action, brand, selection, syntax and error remain independent`);
  expect(tokens.get('--at-cds-clay-ink') !== tokens.get('--at-cds-clay-vivid'), `${mode}/clay ink differs from clay vivid`);
  expect(tokens.get('--at-cds-focus-shadow') === 'none', `${mode}/global focus shadow remains disabled`);

  const page = parseColor(resolve(tokens, '--ds-bg-primary'));
  const composer = paint(tokens, '--ds-bg-composer', page);
  const pairs = [
    ['--ds-text-primary', '--ds-bg-primary', 4.5],
    ['--ds-text-secondary', '--ds-bg-primary', 4.5],
    ['--ds-text-muted', '--ds-bg-elevated-opaque', 4.5],
    ['--at-cds-action-fg', '--at-cds-action-bg', 4.5],
    ['--at-cds-action-fg', '--at-cds-action-hover', 4.5],
    ['--at-cds-selection-fg', '--at-cds-selection-bg', 4.5],
    ['--at-cds-functional-selection-fg', '--at-cds-functional-selection', 3],
    ['--at-cds-functional-selection-fg', '--at-cds-functional-selection-hover', 3],
    ['--at-cds-functional-selection', '--ds-bg-primary', 3],
    ['--at-cds-inline-fg', '--at-cds-inline-code-bg', 4.5],
    ['--at-cds-link', '--ds-bg-primary', 4.5],
    ['--ds-info', '--ds-bg-primary', 4.5],
    ['--at-cds-status-neutral', '--ds-bg-composer', 4.5],
    ['--ds-focus', '--ds-bg-composer', 3],
  ];
  for (const [foreground, background, minimum] of pairs) {
    const ratio = contrast(paint(tokens, foreground, page), paint(tokens, background, page));
    expect(ratio >= minimum, `${mode}/${foreground} on ${background}: ${ratio.toFixed(2)} < ${minimum}`);
    ratios.push({ mode, foreground, background, minimum, ratio });
  }
  const faintRatio = contrast(paint(tokens, '--ds-text-faint', page), page);
  const placeholderRatio = contrast(paint(tokens, '--ds-placeholder-ink', page), composer);
  expect(faintRatio >= 2.8 && faintRatio <= 3.6, `${mode}/faint on page ${faintRatio.toFixed(2)} outside 2.8-3.6 visual target`);
  expect(placeholderRatio >= 2.8 && placeholderRatio <= 3.6, `${mode}/placeholder on composited composer ${placeholderRatio.toFixed(2)} outside 2.8-3.6 visual target`);
  expect(Math.abs(luminance(parseColor(resolve(tokens, '--ds-text-muted'))) - luminance(parseColor(resolve(tokens, '--ds-text-faint')))) >= .10, `${mode}/muted and faint luminance separation >= 0.10`);
  expect(contrast(paint(tokens, '--ds-text-primary', page), paint(tokens, '--at-cds-user-bg', page)) >= 4.5, `${mode}/user bubble text contrast >= 4.5`);
  expect(['--ds-error', '--ds-success', '--ds-warning', '--ds-info'].every(token => /^#[\da-f]{6}$/i.test(resolve(tokens, token))), `${mode}/semantic feedback roles defined`);
  expect(resolve(tokens, '--at-cds-diff-add') !== resolve(tokens, '--ds-success') && resolve(tokens, '--at-cds-diff-del') !== resolve(tokens, '--ds-error'), `${mode}/diff colors independent from feedback roles`);
  console.log(`${mode}: faint ${faintRatio.toFixed(2)}:1; placeholder ${placeholderRatio.toFixed(2)}:1; ${pairs.length} contrast pairs`);
}

const components = read('src/components.css');
const global = read('src/global-controls.css');
const refinements = read('src/refinements.css');
expect(!components.includes('var(--at-cds-brand'), 'no ordinary component consumes brand');
const brandConsumers = [...global.matchAll(/(__SCOPE__[^{}]+)\{[^{}]*var\(--at-cds-brand\)[^{}]*\}/g)].map(match => match[1].trim());
expect(JSON.stringify(brandConsumers) === JSON.stringify(['__SCOPE__ .footer-build-dot', '__SCOPE__ .composer-chip[data-plugin-mark]']), 'build-dot/plugin-chip are the only brand consumers');
expect(global.includes('--at-cds-compose-accent: var(--at-cds-clay-ink)'), 'composer accent uses clay ink');
expect(components.includes('var(--at-cds-clay-vivid)'), 'components use clay vivid for selected activity');
expect(global.includes('outline: none !important') && global.includes('box-shadow: var(--at-cds-ring-shadow) !important'), 'composer shell owns its ring shadow; ordinary field focus stays separate');
expect(global.includes('scroll-margin: 6px'), 'focus styling retains accessible scroll margin');
expect(components.includes('.settings-toggle.on { background: var(--at-cds-functional-selection)'), 'switch uses functional selection color');
expect(components.includes('font-size: .9em; line-height: 1;') && components.includes('border: .5px solid var(--at-cds-inline-border)'), 'inline code remains framed');
expect(refinements.includes('.prose-chat .table-wrap { background: transparent; border: 1px solid var(--at-cds-divider)'), 'table wrap remains the single boundary owner');
expect(!components.includes('file-thumbnail-grow-in'), 'no attachment animation added');
expect(components.includes('--font-mono: "Cascadia Code"') && !components.includes('@font-face'), 'monospace remains a local system stack');

const ordered = ['src/palette.light.css', 'src/components.css', 'src/refinements.css', 'src/settings.css', 'src/global-controls.css'].map(read).join('\n');
const rules = expandRules(compact(ordered)).filter(rule => !rule.selector.startsWith('@') && rule.context.length === 0);
const threadSelector = '__SCOPE__ .sidebar .thread-item-status.running::before';
const threadBackground = finalDeclaration(rules, threadSelector, 'background');
expect(threadBackground === 'var(--at-cds-clay-vivid)', `final thread running-dot cascade uses clay vivid (got ${threadBackground})`);
const projectSelector = '__SCOPE__ .project-run-badge-dot';
const projectBackground = finalDeclaration(rules, projectSelector, 'background');
expect(projectBackground === 'var(--at-cds-clay-vivid)', `final project running-dot cascade uses clay vivid (got ${projectBackground})`);
expect(refinements.includes('data-phase="retrying"') && refinements.includes('data-phase="recovering"'), 'retry and recovery phases remain distinct');

const sansStack = '--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", system-ui, "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;';
const proseStack = '--font-prose: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;';
expect(components.includes(sansStack) && components.includes(proseStack) && components.includes('--font-serif: var(--font-prose)'), 'specified UI/prose stacks and serif alias');
expect(!components.includes('@font-face') && modes.every(mode => !read(`themes/claude-${mode}.css`).includes('@font-face')), 'no packaged fonts');
expect(!/url\(\s*["']?https?:/i.test(components + global + refinements), 'no external font or stylesheet URLs');

const report = {
  policy: 'color-roles',
  version: JSON.parse(read('manifest.json')).version,
  result: 'pass',
  checks: checks.length,
  assertions: checks,
  ratios,
  faintTargets: modes.map(mode => ({ mode, lower: 2.8, upper: 3.6, measuredOn: mode === 'light' ? 'page and composer composited over #fcfcfb' : 'page and composer composited over #151515' })),
  brandConsumers,
  finalRunningColors: { threadDot: threadBackground, projectDot: projectBackground },
  themes: modes.map(mode => ({ mode, sha256: hash(fs.readFileSync(path.join(arg('--theme-dir') || path.join(root, 'themes'), `claude-${mode}.css`))) })),
  limitations: ['Palette and exact-selector source order in unconditional rules only; media states and rendered specificity are checked separately in the browser.'],
};
if (arg('--report')) fs.writeFileSync(arg('--report'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${checks.length} palette, role, contrast and final-cascade checks.`);
