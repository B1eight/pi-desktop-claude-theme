// Maintenance-only utility. Never imported by main.js or shipped host source.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { root } from './build.mjs';
const args=process.argv.slice(2),arg=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
for(const n of ['--asar','--electron-exe','--output-dir'])if(!arg(n))throw Error(n+' required');
if(!process.env.PI_SCRATCH_DIR)throw Error('PI_SCRATCH_DIR required');
const out=path.resolve(arg('--output-dir')),scratch=path.resolve(process.env.PI_SCRATCH_DIR);
if(!out.startsWith(scratch+path.sep)||fs.existsSync(out))throw Error('Output must be a NEW directory under PI_SCRATCH_DIR');
const archive=path.resolve(arg('--asar')),exe=path.resolve(arg('--electron-exe'));
const contract=JSON.parse(fs.readFileSync(path.join(root,'docs/host-contract.json'),'utf8'));
const fd=fs.openSync(archive,'r');let captured;
try{
 const prefix=Buffer.alloc(16);if(fs.readSync(fd,prefix,0,16,0)!==16)throw Error('Truncated ASAR prefix');
 const headerBytes=prefix.readUInt32LE(12);if(headerBytes<2||headerBytes>64*1024*1024)throw Error('Unexpected ASAR header length');
 const header=Buffer.alloc(headerBytes);if(fs.readSync(fd,header,0,header.length,16)!==header.length)throw Error('Truncated ASAR header');
 const tree=JSON.parse(header.toString('utf8')),dataOffset=8+prefix.readUInt32LE(4);
 const read=entryPath=>{
  let entry=tree;for(const part of entryPath.split('/'))entry=entry.files?.[part];
  if(!entry||entry.files||entry.link)throw Error('Missing regular host entry; review contract before updating: '+entryPath);
  if(entry.unpacked)return fs.readFileSync(path.join(archive+'.unpacked',...entryPath.split('/')));
  if(!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>64*1024*1024)throw Error('Unexpected host entry size');
  const b=Buffer.alloc(entry.size);if(fs.readSync(fd,b,0,b.length,dataOffset+Number(entry.offset))!==b.length)throw Error('Truncated ASAR entry');return b;
 };
 captured={hostVersion:JSON.parse(read('package.json')).version,sources:contract.sources.map(s=>({...s,data:read(s.entry)}))};
}finally{fs.closeSync(fd);}
const binary=fs.readFileSync(exe),sentinel=Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'),index=binary.indexOf(sentinel);
if(index<0)throw Error('Electron fuse sentinel absent; refusing to execute');
const wire=binary.subarray(index+sentinel.length,index+sentinel.length+3);
if(wire[0]!==1||wire[1]<1||wire[2]!==49)throw Error('RunAsNode not confirmed enabled; refusing to execute');
const runtime=JSON.parse(execFileSync(exe,['-p','JSON.stringify(process.versions)'],{encoding:'utf8',timeout:15000,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}}).trim());
if(!runtime.electron||!runtime.chrome)throw Error('Not an Electron runtime');
fs.mkdirSync(out,{recursive:true});const sources=[];
for(const source of captured.sources){const file=path.resolve(out,source.file);if(!file.startsWith(out+path.sep))throw Error('Unsafe evidence path');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source.data);sources.push({file:source.file,entry:source.entry,sha256:createHash('sha256').update(source.data).digest('hex')});}
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({hostVersion:captured.hostVersion,sources},null,2)+'\n');
fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify(runtime,null,2)+'\n');
console.log(JSON.stringify({hostVersion:captured.hostVersion,electron:runtime.electron,chrome:runtime.chrome,sources:sources.length,output:out},null,2));
