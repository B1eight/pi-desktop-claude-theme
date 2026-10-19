import assert from 'node:assert/strict';
import {parseRules,splitSelectors} from './css-structure.mjs';
const conditional=s=>/^@(?:media|container|supports)\b/.test(s);
const emit=r=>`${r.prelude}{${r.body}}`;
// Restricted, already scoped build output only. No identity substitution.
export function nestThemeRoots(css,scope){
 assert.equal(splitSelectors(scope).length,1,'One literal theme parent required');
 let pending='',out='',scopesRemoved=0;
 function unwrap(text){return parseRules(text).map(r=>{if(r.prelude===scope){scopesRemoved++;return r.body;}if(conditional(r.prelude))return `${r.prelude}{${unwrap(r.body)}}`;throw Error('Unexpected rule inside condition: '+r.prelude);}).join('');}
 function flush(){if(pending){out+=`${scope}{${pending}}`;pending='';scopesRemoved--;}}
 for(const r of parseRules(css)){
  if(r.prelude===scope){scopesRemoved++;pending+=r.body;}
  else if(conditional(r.prelude))pending+=`${r.prelude}{${unwrap(r.body)}}`;
  else if(/^@keyframes\s/.test(r.prelude)){flush();out+=emit(r);}
  else throw Error('Unexpected top-level rule: '+r.prelude);
 }
 flush();return {css:out,scopesRemoved};
}
export function mergeAdjacent(css){
 const merges=[];
 function walk(text,context=[]){
  const out=[];
  for(const raw of parseRules(text)){
   const r={...raw};
   if(!/^@keyframes\s/.test(r.prelude)&&r.body.includes('{'))r.body=walk(r.body,[...context,r.prelude]);
   const prev=out.at(-1),leaf=!r.body.includes('{')&&!r.prelude.startsWith('@');
   // Selector lists remain leaves. Vendor pseudo-elements must stay independent.
   const safe=leaf&&prev&&!prev.body.includes('{')&&!prev.prelude.startsWith('@')&&prev.body===r.body&&!/::-(?:webkit|moz|ms)-/.test(prev.prelude+r.prelude);
   if(safe){merges.push({context,first:prev.prelude,second:r.prelude,declarations:r.body});prev.prelude+=','+r.prelude;}
   else out.push(r);
  }
  return out.map(emit).join('');
 }
 return {css:walk(css),merges};
}
// Only whitespace immediately following commas in selector/rule preludes.
// Never normalize declaration values, calc operators, descendant spaces or strings.
export function compressResidual(css){
 let removed=0;
 function selector(s){let out='',quote='';for(let i=0;i<s.length;i++){const c=s[i];if(c==='\\'){out+=c+(s[++i]||'');continue;}if(quote){out+=c;if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;out+=c;continue;}out+=c;if(c===','){while(/\s/.test(s[i+1]||'')&&i+1<s.length){i++;removed++;}}}return out;}
 function walk(text){return parseRules(text).map(r=>`${selector(r.prelude)}{${r.body.includes('{')&&!/^@keyframes\s/.test(r.prelude)?walk(r.body):r.body}}`).join('');}
 return {css:walk(css),removed};
}
// Structural proof: full selectors, condition order and declaration text retained.
export function normalizedRecords(css,parent='',conditions=[]){
 const rows=[];
 for(const r of parseRules(css)){
  if(conditional(r.prelude)){rows.push(...normalizedRecords(r.body,parent,[...conditions,r.prelude]));continue;}
  if(r.prelude.startsWith('@')){assert(!parent,'Global at-rule must remain global');rows.push({conditions,raw:emit(r)});continue;}
  const list=splitSelectors(r.prelude);
  if(parent){assert.equal(splitSelectors(parent).length,1,'Multi-selector nested parent rejected');assert(list.every(s=>s.startsWith('&')),'Explicit & required');}
  const expanded=list.map(s=>parent?s.replaceAll('&',parent):s);
  if(r.body.includes('{')){assert.equal(expanded.length,1,'Merged leaves must never become nested parents');rows.push(...normalizedRecords(r.body,expanded[0],conditions));}
  else for(const selector of expanded)rows.push({conditions,selector,body:r.body});
 }
 return rows;
}
