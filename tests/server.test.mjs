import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('isolated local server has no personal state and rejects unsafe requests',async()=>{
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const dir=await mkdtemp(path.join(tmpdir(),'job-radar-test-'));
  const child=spawn(process.execPath,[fileURLToPath(new URL('../local-server.mjs',import.meta.url))],{env:{...process.env,JOB_RADAR_PORT:String(port),JOB_RADAR_DATA_DIR:dir},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let errors='';child.stderr.on('data',chunk=>errors+=chunk);const base=`http://127.0.0.1:${port}`;
  try{
    let ready=false;for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/state');if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready,errors);
    const s=await(await fetch(base+'/api/state')).json();assert.equal(s.profile,'');assert.equal(s.keyConfigured,false);assert.deepEqual(s.applied,{});assert.equal(s.last,null);assert.equal('apiKey' in s,false);assert.equal(typeof s.csrf,'string');
    assert.equal((await fetch(base+'/local-data/state.json')).status,404);
    assert.equal((await fetch(base+'/api/settings',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
    const search=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json','x-local-token':s.csrf},body:JSON.stringify({query:'software engineer',location:'United States',publisher:'all',date:'week',type:'FULLTIME'})});assert.equal(search.status,400);assert.match((await search.json()).error,/密钥/);
    assert.equal((await(await fetch(base+'/api/state')).json()).usage,0);
    const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.equal((await fetch(base+'/local-app.js')).status,200);
  }finally{
    child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));
    const safe=path.resolve(dir);assert.ok(safe.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(safe).startsWith('job-radar-test-'));await rm(safe,{recursive:true,force:true});
  }
});
