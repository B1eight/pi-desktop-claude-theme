import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { root } from './build.mjs';
const args=process.argv.slice(2),arg=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const host=arg('--host-root'),runtimeFile=arg('--runtime-json');
if(!host||!runtimeFile)throw Error('--host-root and --runtime-json required; host source is never distributed');
const contract=JSON.parse(fs.readFileSync(path.join(root,'docs/host-contract.json'),'utf8'));
const evidence=JSON.parse(fs.readFileSync(path.join(host,'evidence.json'),'utf8')),runtime=JSON.parse(fs.readFileSync(runtimeFile,'utf8'));
let checks=0;const errors=[],check=(v,message)=>{checks++;if(!v)errors.push(message);};
const text=new Map();const digest=b=>createHash('sha256').update(b).digest('hex');
for(const source of contract.sources){
 const actual=evidence.sources.find(s=>s.file===source.file);check(actual?.entry===source.entry,'Source mapping changed: '+source.file);
 const file=path.resolve(host,source.file);check(file.startsWith(path.resolve(host)+path.sep)&&fs.existsSync(file),'Missing or unsafe source: '+source.file);
 if(!fs.existsSync(file))continue;
 const data=fs.readFileSync(file);check(digest(data)===source.sha256&&actual?.sha256===source.sha256,'Source fingerprint changed: '+source.file);text.set(source.file,data.toString('utf8'));
}
const input={version:evidence.hostVersion,runtime,css:[...text].filter(([p])=>p.endsWith('.css')).map(([,s])=>s).join('\n'),renderer:[...text].filter(([p])=>p.startsWith('renderer/')).map(([,s])=>s).join('\n')};
function validate(input){
 const result=[];const test=(ok,id)=>result.push({id,pass:!!ok});
 test(input.version===contract.validatedHostVersion,'host-version');
 test(/^\d+\./.test(input.runtime.chrome||'')&&Number(input.runtime.chrome.split('.')[0])>=contract.minimumChromeMajorForNesting,'native-nesting-engine');
 for(const group of contract.groups){
  for(const marker of group.css)test(input.css.includes(marker),group.id+':css:'+marker);
  for(const marker of group.renderer)test(input.renderer.includes(marker),group.id+':renderer:'+marker);
  for(const pattern of group.patterns||[])test(new RegExp(pattern).test(input.renderer),group.id+':structure:'+pattern);
 }
 return result;
}
const results=validate(input);for(const r of results)check(r.pass,r.id);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));check(manifest.engines.piDesktop===contract.declaredEngineRange,'Engine declaration changed without review');
let negativeChecks=0;
if(args.includes('--self-test')){
 assert.ok(validate({...input,version:'0.0.0'}).some(r=>r.id==='host-version'&&!r.pass));negativeChecks++;
 assert.ok(validate({...input,runtime:{chrome:'119.0.0.0'}}).some(r=>r.id==='native-nesting-engine'&&!r.pass));negativeChecks++;
 for(const group of contract.groups){const marker=group.renderer[0];assert.ok(validate({...input,renderer:input.renderer.replaceAll(marker,'REMOVED')}).some(r=>r.id.startsWith(group.id+':renderer:')&&!r.pass));negativeChecks++;}
 const marker=contract.groups[0].css[0];assert.ok(validate({...input,css:input.css.replaceAll(marker,'REMOVED')}).some(r=>r.id.includes(':css:')&&!r.pass));negativeChecks++;
 assert.notEqual(digest(Buffer.from(text.get('index.css')+'\nchanged')),contract.sources.find(s=>s.file==='index.css').sha256);negativeChecks++;
}
const report={stage:1,hostVersion:evidence.hostVersion,runtime:{electron:runtime.electron,chrome:runtime.chrome},groups:contract.groups.map(g=>g.id),sourceFiles:contract.sources.length,checks,negativeChecks,failed:errors,sourceEvidence:evidence.sources,limits:'Presence/structural signatures plus exact source fingerprints; not full DOM equivalence, behavior, persistence or future-version certification.'};
if(arg('--report'))fs.writeFileSync(arg('--report'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,sourceEvidence:undefined},null,2));if(errors.length)process.exitCode=1;
