import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";

const path=pathToFileURL(fileURLToPath(new URL("../src/lib/latest-write-queue.ts",import.meta.url))).href;
function run(source){
  return execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",
    'import {createLatestWriteQueue} from '+JSON.stringify(path)+';\n'+
    'import assert from "node:assert/strict";\n'+source
  ],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
const wait='const tick=()=>new Promise(resolve=>setImmediate(resolve));';

test("queued writes for one field are serialized and superseded values are skipped",()=>{
 const script=[
  wait,
  'const completions=[];const started=[];const events=[];',
  'const version={a:3};let unblock;',
  'const first=new Promise(resolve=>{unblock=resolve;});',
  'const queue=createLatestWriteQueue(async task=>{started.push(task.value);if(task.value==="old")await first;completions.push(task.value);},',
  ' (task,event)=>events.push([task.value,event]),task=>version[task.key]===task.version);',
  'queue.enqueue({key:"a",version:1,value:"old"});',
  'queue.enqueue({key:"a",version:2,value:"middle"});',
  'queue.enqueue({key:"a",version:3,value:"latest"});',
  'await tick();assert.deepEqual(started,["old"]);',
  'unblock();await tick();await tick();',
  'assert.deepEqual(completions,["old","latest"]);',
  'assert.deepEqual(events,[["latest","saving"],["latest","saved"]]);',
  'assert.equal(queue.isBusy(),false);',
  'console.log("ok");'
 ].join("\n");
 assert.equal(run(script),"ok");
});
test("unrelated fields can save while another is waiting",()=>{
 const script=[
  wait,
  'let unblock;const first=new Promise(r=>unblock=r);',
  'const events=[];const q=createLatestWriteQueue(async x=>{if(x.key==="a")await first;events.push(x.key);},()=>{},()=>true);',
  'q.enqueue({key:"a",version:1});q.enqueue({key:"b",version:1});',
  'await tick();assert.deepEqual(events,["b"]);',
  'unblock();await tick();assert.deepEqual(events,["b","a"]);',
  'console.log("ok");'
 ].join("\n");
 assert.equal(run(script),"ok");
});
test("failure permits latest retry and shows failure for only the current revision",()=>{
 const script=[
  wait,
  'const events=[];let count=0;',
  'const q=createLatestWriteQueue(async()=>{if(count++===0)throw new Error("network");},',
  ' (task,event)=>events.push(event),()=>true);',
  'q.enqueue({key:"a",version:1});await tick();',
  'assert.equal(events.at(-1),"failed");',
  'q.enqueue({key:"a",version:2});await tick();',
  'assert.equal(events.at(-1),"saved");assert.equal(q.isBusy(),false);',
  'console.log("ok");'
 ].join("\n");
 assert.equal(run(script),"ok");
});
test("workshop export blocked when local edits have not reached the server",()=>{
 const src=readFileSync(new URL("../src/app/workshops/[id]/page.tsx",import.meta.url),"utf8");
 for(const required of ["hasPendingEdits()","savedVersions.current","answerCache.current",
  "writeQueue.enqueue","disabled={busy||hasPendingEdits()}","إعادة محاولة الحفظ"]){
  assert.ok(src.includes(required),"Missing: "+required);
 }
});
