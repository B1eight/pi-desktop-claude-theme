// Node built-ins + an existing Chrome; no dependencies or host runtime changes.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function browser(out,chromePath='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'){
 fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync(path.join(out,'chrome-')),portFile=path.join(profile,'DevToolsActivePort');
 const child=spawn(chromePath,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','about:blank'],{stdio:'ignore'});
 let ws;try{
  for(let i=0;i<150&&!fs.existsSync(portFile);i++)await wait(100);
  if(!fs.existsSync(portFile))throw Error('Chrome CDP startup timeout');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0],targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const metrics=(width,height=1100)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const key=async(key,code,vk,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await cdp('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:vk,modifiers});};
  const point=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const screenshot=async(name,full=true)=>{const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:full});fs.writeFileSync(path.join(out,name),Buffer.from(r.data,'base64'));};
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await metrics(1100);
  return{cdp,evaluate,key,point,metrics,screenshot,close:async()=>{try{await cdp('Browser.close');}finally{ws.close();if(child.exitCode===null)child.kill();}}};
 }catch(e){ws?.close();if(child.exitCode===null)child.kill();throw e;}
}
