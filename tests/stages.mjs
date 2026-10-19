import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,scope,themeArtifact} from '../scripts/build.mjs';
import {compact,factorScope} from '../scripts/css-structure.mjs';
import {factorPrefixes} from '../scripts/css-prefixes.mjs';
import {nestThemeRoots,mergeAdjacent,compressResidual} from '../scripts/css-capacity.mjs';
// Baseline is current source + same complete long identity, before capacity steps.
// The over-budget baseline is test data only, never an installable output option.
export function stages(mode){
 const final=themeArtifact(mode),prefixBytes=final.report.parts.slice(0,2).reduce((n,p)=>n+p.bytes,0),prefix=Buffer.from(final.css).subarray(0,prefixBytes).toString('utf8');
 const names=[`palette.${mode}.css`,'components.css','refinements.css','settings.css','global-controls.css'];
 const baselineBody=names.map(f=>factorPrefixes(factorScope(compact(fs.readFileSync(path.join(root,'src',f),'utf8')).replaceAll('__SCOPE__',scope(mode)),scope(mode)))).join('');
 const a=nestThemeRoots(baselineBody,scope(mode)),b=mergeAdjacent(a.css),c=compressResidual(b.css);
 const body={baseline:baselineBody,step1:a.css,step2:b.css,step3:c.css},css=Object.fromEntries(Object.entries(body).map(([k,v])=>[k,prefix+v+'\n']));
 assert.equal(css.step3,final.css,'Independent reconstruction agrees with actual builder');
 return{body,css,rootNesting:a,adjacent:b,residual:c,report:final.report};
}
