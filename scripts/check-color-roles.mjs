import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './build.mjs';
/* visual-candidate color role matrix. Historical 1.1.0 results remain frozen. */
const args=process.argv.slice(2),arg=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const checks=[],expect=(pass,label)=>{if(!pass)throw Error(label);checks.push(label);};
const palette=mode=>new Map([...read(`src/palette.${mode}.css`).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
function luminance(hex){const a=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
function contrast(a,b){const x=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(x[0]+.05)/(x[1]+.05);}
const ratios=[];
for(const mode of ['light','dark']){
 const p=palette(mode),value=k=>p.get(k)?.replace(/^var\((--[\w-]+)\)$/,(_,k)=>p.get(k));
 const literals=mode==='light'?{'--at-cds-action-bg':'#0b0b0b','--at-cds-inline-fg':'#8e2626','--at-cds-functional-selection':'#2674cf'}:{'--at-cds-action-bg':'#f0efec','--ds-text-primary':'#f0efec','--ds-text-secondary':'#c3c2b7','--ds-text-muted':'#96948d','--at-cds-inline-fg':'#f1a6a6','--at-cds-functional-selection':'#397ed4'};
 for(const[k,v]of Object.entries(literals))expect(p.get(k)===v,`${mode}/${k} candidate target (not official token)`);
 expect(p.get('--at-cds-brand')==='#d97757',`${mode}/brand retained`);
 expect(new Set(['--at-cds-action-bg','--at-cds-brand','--at-cds-functional-selection','--at-cds-inline-fg','--ds-error'].map(value)).size===5,`${mode}/action-brand-selection-code-error independent`);
 for(const[fg,bg,min]of [['--at-cds-action-fg','--at-cds-action-bg',4.5],['--at-cds-action-fg','--at-cds-action-hover',4.5],['--at-cds-inline-fg','--at-cds-inline-code-bg',4.5],['--at-cds-functional-selection-fg','--at-cds-functional-selection',3],['--at-cds-functional-selection-fg','--at-cds-functional-selection-hover',3],['--at-cds-functional-selection','--ds-bg-primary',3],['--ds-focus','--ds-bg-composer',3],['--ds-text-muted','--ds-bg-elevated-opaque',4.5],['--ds-text-primary','--at-cds-user-bg',4.5],['--ds-info','--ds-bg-primary',4.5]]){
  const ratio=contrast(value(fg),value(bg));expect(ratio>=min,`${mode}/${fg}/${bg} >=${min}`);ratios.push({mode,fg,bg,min,ratio});
 }
 expect(['--ds-error','--ds-success','--ds-warning','--ds-info'].every(k=>/^#[\da-f]{6}$/i.test(value(k))),`${mode}/semantic roles`);
 expect(!/success|error/.test(p.get('--at-cds-diff-add')+p.get('--at-cds-diff-del')),`${mode}/diff independent`);
}
const c=read('src/components.css'),g=read('src/global-controls.css'),r=read('src/refinements.css');
expect(!c.includes('var(--at-cds-brand'),'no ordinary component consumes brand');
const brandConsumers=[...g.matchAll(/(__SCOPE__[^{}]+)\{[^{}]*var\(--at-cds-brand\)[^{}]*\}/g)].map(m=>m[1].trim());
expect(JSON.stringify(brandConsumers)===JSON.stringify(['__SCOPE__ .footer-build-dot','__SCOPE__ .composer-chip[data-plugin-mark]']),'explicit two-node brand whitelist');
const runningBrandConsumers=[...r.matchAll(/(__SCOPE__[^{}]+)\{[^{}]*var\(--at-cds-brand\)[^{}]*\}/g)].map(m=>m[1].trim());
expect(runningBrandConsumers.length===0&&r.includes('.thread-item-status.running::before { width: 10px; height: 10px; background: var(--ds-info);'),'1.1.4 sidebar blue, no terracotta consumer');
expect(c.includes('.settings-toggle.on { background: var(--at-cds-functional-selection)'),'switch functional selection');
expect(c.includes('font-size: .9em; line-height: 1;')&&c.includes('border: .5px solid var(--at-cds-inline-border)'),'content code frame');
expect(r.includes('.table-wrap { background: transparent; border: 1px solid var(--at-cds-divider)'),'one table boundary owner');
expect(c.includes('--font-sans: "AT CDS Inter",')&&c.includes('--font-mono: "AT CDS Mono",'),'licensed packaged fonts first unless host inline selection');
expect(g.includes('outline-offset: calc(-1 * var(--at-cds-composer-ring)) !important;')&&g.includes('scroll-margin: 6px'),'mode-specific inset Composer and accessible scroll margin');
expect(!c.includes('file-thumbnail-grow-in'),'no new attachment animation');
const report={policy:'visual-candidate',baseVersion:'1.1.0',result:'pass',checks:checks.length,assertions:checks,ratios,brandConsumers,themes:['light','dark'].map(mode=>({mode,sha256:hash(fs.readFileSync(path.join(arg('--theme-dir')||path.join(root,'themes'),`claude-${mode}.css`)))})),limitations:['Palette/static policy only; rendered token perturbation is checked separately.']};
if(arg('--report'))fs.writeFileSync(arg('--report'),JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${checks.length} visual-candidate palette/role checks.`);
