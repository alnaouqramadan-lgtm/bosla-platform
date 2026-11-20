/**
 * Per-field, latest-value-wins write queue.
 * Writes for the same field execute sequentially; independent fields stay concurrent.
 * This protects initial inserts and subsequent updates against out-of-order requests.
 */
export type SaveEvent="saving"|"saved"|"failed";
export function createLatestWriteQueue<T extends {key:string;version:number}>(
 write:(task:T)=>Promise<void>,
 event:(task:T,kind:SaveEvent,error?:unknown)=>void,
 isCurrent:(task:T)=>boolean
){
 const pending=new Map<string,T>();
 const busy=new Set<string>();
 async function drain(key:string):Promise<void>{
  if(busy.has(key))return;
  busy.add(key);
  try{
   while(pending.has(key)){
    const task=pending.get(key)!;
    pending.delete(key);
    if(isCurrent(task))event(task,"saving");
    try{
     await write(task);
     if(!pending.has(key)&&isCurrent(task))event(task,"saved");
    }catch(error){
     if(!pending.has(key)&&isCurrent(task))event(task,"failed",error);
    }
   }
  }finally{
   busy.delete(key);
   if(pending.has(key))void drain(key);
  }
 }
 return {
  enqueue(task:T):void{pending.set(task.key,task);void drain(task.key);},
  isBusy(key?:string):boolean{return key?busy.has(key)||pending.has(key):busy.size>0||pending.size>0;}
 };
}
