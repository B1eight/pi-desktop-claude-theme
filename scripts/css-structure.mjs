// Restricted build-time CSS parser: never evaluates CSS or runs in the plugin.
// Unknown group rules and malformed syntax fail closed rather than being rewritten.
export function splitSelectors(text) {
  const result = []; let start = 0, quote = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { result.push(text.slice(start, i).trim()); start = i + 1; }
  }
  if (quote || depth !== 0) throw Error('Unbalanced selector');
  result.push(text.slice(start).trim());
  if (result.some(s => !s)) throw Error('Empty selector');
  return result;
}

export function parseRules(css) {
  const rules = []; let i = 0;
  while (i < css.length) {
    while (/\s/.test(css[i] || '') && i < css.length) i++;
    if (i === css.length) break;
    const start = i; let quote = '', depth = 0;
    for (; i < css.length; i++) {
      const c = css[i];
      if (c === '\\') { i++; continue; }
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === ';' && depth === 0) throw Error('Statement at-rules are not supported');
      if (c === '{' && depth === 0) break;
    }
    if (i === css.length || quote || depth) throw Error('Missing CSS block');
    const prelude = css.slice(start, i).trim(); const bodyStart = ++i; let braces = 1; quote = '';
    for (; i < css.length; i++) {
      const c = css[i];
      if (c === '\\') { i++; continue; }
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '{') braces++;
      if (c === '}' && --braces === 0) break;
    }
    if (braces || quote) throw Error('Unbalanced CSS block');
    rules.push({ prelude, body: css.slice(bodyStart, i) }); i++;
  }
  return rules;
}

export function compact(css) {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1').trim();
  let result = '', quote = '';
  for (let i = 0; i < flat.length; i++) {
    const c = flat[i];
    if (c === '\\') { result += c + (flat[++i] || ''); continue; }
    if (quote) { result += c; if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; result += c; continue; }
    // Never remove the descendant space BEFORE a pseudo-class colon.
    if (c === ',') result = result.trimEnd();
    if (c === '}' && result.endsWith(';')) result = result.slice(0, -1);
    result += c;
    if (c === ':' || c === ',' || c === '(') while (flat[i + 1] === ' ') i++;
  }
  return result;
}

// Every nested child contains an explicit &, with exactly ONE parent selector.
// Its specificity is therefore identical to the original full prefix, not the
// maximum specificity of a mixed selector list. Keep rule order and bodies intact.
export function factorScope(css, scope) {
  const emit = source => {
    let output = '', pending = [];
    const flush = () => { if (pending.length) { output += `${scope}{${pending.join('')}}`; pending = []; } };
    for (const rule of parseRules(source)) {
      if (/^@(?:media|container|supports)\b/.test(rule.prelude)) {
        flush(); output += `${rule.prelude}{${emit(rule.body)}}`; continue;
      }
      if (/^@(?:font-face|keyframes)\b/.test(rule.prelude)) {
        flush(); output += `${rule.prelude}{${rule.body}}`; continue;
      }
      if (rule.prelude.startsWith('@')) throw Error(`Unsupported at-rule: ${rule.prelude}`);
      const selectors = splitSelectors(rule.prelude);
      for (const selector of selectors) {
        if (!selector.startsWith(scope) || selector.slice(scope.length).includes(scope)) throw Error(`Unexpected theme prefix: ${selector}`);
      }
      if (rule.body.includes('{')) throw Error('Source nesting must be reviewed explicitly');
      pending.push(`${selectors.map(s => '&' + s.slice(scope.length)).join(', ')}{${rule.body}}`);
    }
    flush(); return output;
  };
  return emit(css);
}

// Structural expansion for build-time checks; the browser audit independently
// expands Chromium CSSOM and compares it against the pre-change flat stylesheet.
export function expandRules(css, parent = '', context = []) {
  return parseRules(css).flatMap(rule => {
    if (/^@(?:media|container|supports)\b/.test(rule.prelude)) return expandRules(rule.body, parent, [...context, rule.prelude]);
    if (rule.prelude.startsWith('@')) return [{ context, selector: rule.prelude, body: rule.body }];
    const selector = parent ? rule.prelude.replaceAll('&', parent) : rule.prelude;
    if (rule.body.includes('{')) return expandRules(rule.body, selector, context);
    return [{ context, selector, body: rule.body }];
  });
}
