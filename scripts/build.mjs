import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { compact, factorScope } from './css-structure.mjs';
import { factorPrefixes } from './css-prefixes.mjs';
import { nestThemeRoots, mergeAdjacent, compressResidual } from './css-capacity.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const fonts = [
  ['Inter', 'AT CDS Inter', 'Regular', 400, 'normal'],
  ['Inter', 'AT CDS Inter', 'SemiBold', 600, 'normal'],
  ['Inter', 'AT CDS Inter', 'Bold', 700, 'normal'],
  ['Inter', 'AT CDS Inter', 'Italic', 400, 'italic'],
  ['JetBrainsMono', 'AT CDS Mono', 'Regular', 400, 'normal'],
  ['JetBrainsMono', 'AT CDS Mono', 'Italic', 400, 'italic'],
].map(([file, family, face, weight, style]) => ({
  family, path: `assets/fonts/${file}-${face}.woff2`, weight, style,
}));
export const id = 'io.github.b1eight.pi-desktop-claude-theme';
export const scope = mode => `:root[data-theme="${mode}"][data-plugin-theme="plugin:${id}:claude-${mode}"]`;
export const HARD_LIMIT = 256 * 1024;
export const SOFT_RESERVE = 4 * 1024;
export const PREFERRED_RESERVE = 8 * 1024;
const bytes = text => Buffer.byteLength(text, 'utf8');
const sha256 = text => createHash('sha256').update(text).digest('hex');
export function budgetStatus(total) {
  if (!Number.isSafeInteger(total) || total < 0) throw Error('Invalid CSS byte count');
  return { total, hardLimit: HARD_LIMIT, remaining: HARD_LIMIT - total, warning: total > HARD_LIMIT - SOFT_RESERVE, ok: total <= HARD_LIMIT };
}
export function enforceBudget(total) {
  const status = budgetStatus(total);
  if (!status.ok) throw Error(`Theme exceeds host CSS budget (${total} > ${HARD_LIMIT})`);
  return status;
}

export function themeArtifact(mode) {
  if (!['light', 'dark'].includes(mode)) throw new Error('Unknown theme');
  let fontBytes = 0, payloadBytes = 0;
  const faces = fonts.map(font => {
    const raw = fs.readFileSync(path.join(root, font.path));
    const data = raw.toString('base64'); fontBytes += raw.length; payloadBytes += bytes(data);
    return `@font-face{font-family:"${font.family}";src:url("data:font/woff2;base64,${data}") format("woff2");font-weight:${font.weight};font-style:${font.style};font-display:swap}`;
  }).join('');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const header = `/* Claude Theme ${manifest.version} ${mode}\n * Caho1/open-claude-ui@2834bc158a4849f21c97cbb2e0b10525f6e646f1 MIT\n * SIL OFL 1.1: LICENSE, assets/licenses/.\n * scripts/build.mjs\n */\n`;
  const parts = [{ name: 'header', text: header }, { name: 'fonts', text: faces + '\n' }];
  const sections = [
    ['palette', `palette.${mode}.css`], ['components', 'components.css'],
    ['refinements', 'refinements.css'], ['settings', 'settings.css'],
    ['globalControls', 'global-controls.css'],
  ];
  const contributions = [];
  for (const [name, file] of sections) {
    const source = fs.readFileSync(path.join(root, 'src', file), 'utf8');
    const flat = compact(source).replaceAll('__SCOPE__', scope(mode));
    const scoped = factorScope(flat, scope(mode));
    const factored = factorPrefixes(scoped);
    parts.push({ name, text: factored });
    contributions.push({ name, file: `src/${file}`, sourceBytes: bytes(source), sourceSha256: sha256(source), flatBytes: bytes(flat), scopedBytes: bytes(scoped), prefixSavedBytes: bytes(scoped) - bytes(factored), factoredBytes: bytes(factored), savedBytes: bytes(flat) - bytes(factored) });
  }
  parts.push({ name: 'trailingNewline', text: '\n' });
  const beforeBody = parts.slice(2, -1).map(p => p.text).join('');
  const nested = nestThemeRoots(beforeBody, scope(mode));
  const merged = mergeAdjacent(nested.css);
  const compressed = compressResidual(merged.css);
  const finalParts = [parts[0], parts[1], {name:'optimizedStyles',text:compressed.css}, parts.at(-1)];
  const css = finalParts.map(p => p.text).join('');
  const status = enforceBudget(bytes(css));
  return { css, report: {
    mode, version: manifest.version, ...status, softReserve: SOFT_RESERVE, preferredReserve: PREFERRED_RESERVE,
    sha256: sha256(css), fontFaces: fonts.length, fontBinaryBytes: fontBytes, fontPayloadBytes: payloadBytes,
    fontDeclarationAndSeparatorBytes: bytes(faces + '\n') - payloadBytes,
    parts: finalParts.map(p => ({ name: p.name, bytes: bytes(p.text) })), contributions,
    contributionScope: 'Per-source contributions before the three cross-section output transforms',
    optimization: { rootNestingSaved:bytes(beforeBody)-bytes(nested.css), adjacentMergingSaved:bytes(nested.css)-bytes(merged.css), residualCompressionSaved:bytes(merged.css)-bytes(compressed.css), mergeCount:merged.merges.length, scopesRemoved:nested.scopesRemoved },
    factoringSavedBytes: contributions.reduce((sum, p) => sum + p.savedBytes, 0) + bytes(beforeBody)-bytes(compressed.css),
  } };
}
export const renderTheme = mode => themeArtifact(mode).css;

export function build(outputDirectory = path.join(root, 'themes'), reportPath) {
  // Validate BOTH modes before writing either; callers cannot override hard limits.
  const artifacts = ['light', 'dark'].map(themeArtifact);
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const { css, report } of artifacts) {
    fs.writeFileSync(path.join(outputDirectory, `claude-${report.mode}.css`), css, 'utf8');
    console.log(`Built ${report.mode}: ${report.total} bytes; remaining ${report.remaining}; factoring saved ${report.factoringSavedBytes}`);
    if (report.warning) console.warn(`WARNING: ${report.mode} has less than ${SOFT_RESERVE} bytes maintenance reserve`);
  }
  if (reportPath) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify({ schemaVersion: 1, modes: artifacts.map(a => a.report) }, null, 2) + '\n'); }
  return artifacts.map(a => a.report);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--output-dir', '--report'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error('Usage: build.mjs [--output-dir DIR] [--report FILE]');
    options[args[i]] = path.resolve(args[i + 1]);
  }
  build(options['--output-dir'], options['--report']);
}
