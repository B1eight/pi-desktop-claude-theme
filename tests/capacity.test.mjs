import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,scope,HARD_LIMIT,enforceBudget} from '../scripts/build.mjs';
import {nestThemeRoots,mergeAdjacent,compressResidual,normalizedRecords} from '../scripts/css-capacity.mjs';
import {stages} from './stages.mjs';
const s=':root[data-test="complete-long-id"]';
test('root nesting retains conditions, order, and global keyframes',()=>{const a=`${s}{& .a{color:red}}@media (width>1px){${s}{& .b{color:blue}}@supports (display:grid){${s}{& .c{display:grid}}}}@keyframes x{from{opacity:0}to{opacity:1}}${s}{& .d{color:green}}`;assert.deepEqual(normalizedRecords(nestThemeRoots(a,s).css),normalizedRecords(a));});
test('unscoped rule is rejected',()=>assert.throws(()=>nestThemeRoots('.x{color:red}',s),/Unexpected/));
test('unknown conditional group is rejected',()=>assert.throws(()=>nestThemeRoots('@layer x{'+s+'{& .a{color:red}}}',s),/Unexpected/));
test('selector-list parent is rejected',()=>assert.throws(()=>nestThemeRoots('',s+','+s),/One literal/));
test('adjacent equal declarations merge, nonadjacent do not',()=>{const a=`${s}{& .a{color:red}& .b{color:red}& .c{color:blue}& .d{color:red}}`,r=mergeAdjacent(a);assert.equal(r.merges.length,1);assert.deepEqual(normalizedRecords(r.css),normalizedRecords(a));});
test('condition boundary prevents adjacent merging',()=>assert.equal(mergeAdjacent(`${s}{& .a{color:red}@media (width>1px){& .b{color:red}}& .c{color:red}}`).merges.length,0));
test('vendor pseudo-element lists remain separate',()=>{const a=`${s}{& input::-webkit-slider-runnable-track{height:4px}& input::-moz-range-track{height:4px}}`;assert.equal(mergeAdjacent(a).css,a);});
test('declaration order is significant',()=>assert.equal(mergeAdjacent(`${s}{& .a{color:red;background:blue}& .b{background:blue;color:red}}`).merges.length,0));
test('residual compression preserves strings, descendant space and values',()=>{const a=`${s}{& [data-x="a, b"], & .b :hover{content:"a, b";--x:a, b;width:calc(1px + 2px)}}`,r=compressResidual(a);assert.equal(r.removed,1);assert(r.css.includes('[data-x="a, b"],& .b :hover'));assert(r.css.includes('content:"a, b";--x:a, b;width:calc(1px + 2px)'));assert.deepEqual(normalizedRecords(r.css),normalizedRecords(a));});
test('over-budget output cannot bypass the hard limit',()=>assert.throws(()=>enforceBudget(HARD_LIMIT+1),/exceeds/));
for(const mode of ['light','dark']){
 const r=stages(mode);
 for(const step of ['step1','step2','step3'])test(`${mode}/${step}: exact expanded selector, conditions and declaration order`,()=>assert.deepEqual(normalizedRecords(r.body[step]),normalizedRecords(r.body.baseline)));
 test(`${mode}: complete ID retained and transformations accounted for`,()=>{assert(r.body.step3.includes(scope(mode)));assert.equal(r.rootNesting.scopesRemoved,28);assert.equal(r.adjacent.merges.length,7);assert.equal(r.residual.removed,14);const n=r.report.optimization;assert.equal(Buffer.byteLength(r.css.baseline)-Buffer.byteLength(r.css.step3),n.rootNestingSaved+n.adjacentMergingSaved+n.residualCompressionSaved);});
 test(`${mode}: generated theme, manifest mapping and part totals are current`,()=>{const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')),t=m.contributes.themes.find(t=>t.base===mode);assert.equal(t.id,'claude-'+mode);assert.equal(t.path,`themes/claude-${mode}.css`);assert.equal(fs.readFileSync(path.join(root,t.path),'utf8'),r.css.step3);assert.equal(r.report.parts.reduce((s,p)=>s+p.bytes,0),Buffer.byteLength(r.css.step3));assert(r.report.total<=HARD_LIMIT);});
}
