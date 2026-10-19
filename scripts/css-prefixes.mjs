import { parseRules, splitSelectors } from './css-structure.mjs';

// Build-time only. Factor consecutive rules under exactly ONE literal parent.
// Each child has an explicit &: specificity, order, declarations and inheritance
// are unchanged. No token substitution, selector union or declaration movement.
function prefixes(selector) {
  const result = []; let quote = '', depth = 0;
  for (let i = 0; i <= selector.length; i++) {
    const c = selector[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (depth === 0 && (c === ' ' || i === selector.length)) {
      const prefix = selector.slice(0, i).trim();
      if (prefix.startsWith('& ') && !/[>+~]$/.test(prefix) && !prefix.includes('::')) result.push(prefix);
    }
  }
  return result;
}
function group(rules) {
  let output = '';
  for (let i = 0; i < rules.length;) {
    const first = rules[i];
    if (first.prelude.startsWith('@') || first.body.includes('{')) throw Error('Expected scoped, flat style rules');
    const selectors = splitSelectors(first.prelude);
    const candidates = prefixes(selectors[0]).filter(p => selectors.every(s => s === p || s.startsWith(p + ' ')));
    let best;
    for (const prefix of candidates) {
      let original = '', children = '';
      for (let j = i; j < rules.length; j++) {
        const rule = rules[j];
        if (rule.prelude.startsWith('@') || rule.body.includes('{')) break;
        const list = splitSelectors(rule.prelude);
        if (!list.every(s => s === prefix || s.startsWith(prefix + ' '))) break;
        original += `${rule.prelude}{${rule.body}}`;
        children += `${list.map(s => '&' + s.slice(prefix.length)).join(',')}{${rule.body}}`;
        const saved = original.length - (prefix.length + 2 + children.length);
        if (saved > 0 && (!best || saved > best.saved)) best = { prefix, end: j, saved };
      }
    }
    if (!best) { output += `${first.prelude}{${first.body}}`; i++; continue; }
    const children = rules.slice(i, best.end + 1).map(rule => ({
      prelude: splitSelectors(rule.prelude).map(s => '&' + s.slice(best.prefix.length)).join(','), body: rule.body,
    }));
    output += `${best.prefix}{${group(children)}}`; i = best.end + 1;
  }
  return output;
}
export function factorPrefixes(css) {
  return parseRules(css).map(rule => {
    if (/^@(?:media|container|supports)\b/.test(rule.prelude)) return `${rule.prelude}{${factorPrefixes(rule.body)}}`;
    if (rule.prelude.startsWith('@') || !rule.body.includes('{')) return `${rule.prelude}{${rule.body}}`;
    if (splitSelectors(rule.prelude).length !== 1) throw Error('Prefix factoring requires one scope parent');
    return `${rule.prelude}{${group(parseRules(rule.body))}}`;
  }).join('');
}
