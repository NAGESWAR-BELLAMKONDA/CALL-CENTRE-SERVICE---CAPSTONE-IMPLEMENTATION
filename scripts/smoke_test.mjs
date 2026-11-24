import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const port=18991;
const base="http://127.0.0.1:"+port;
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"cciq-smoke-"));
const child=spawn(process.execPath,["server.js"],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:dataDir,DEMO_INTERVAL_MS:"1200",APP_ORIGIN:"*"},stdio:["ignore","pipe","pipe"]});
let logs="";
child.stdout.on("data",x=>logs+=x.toString());
child.stderr.on("data",x=>logs+=x.toString());
async function waitForServer(){
  for(let i=0;i<50;i++){
    try{const r=await fetch(base+"/api/health");if(r.ok)return await r.json();}catch{}
    await delay(200);
  }
  throw new Error("Server did not become healthy. "+logs);
}
try{
  const health=await waitForServer();
  if(!health.ok)throw new Error("Health endpoint returned not ok");
  const initial=await (await fetch(base+"/api/agents")).json();
  if(initial.total!==30)throw new Error("Expected 30 seeded agents; got "+initial.total);
  const record={Agent_ID:999,Group:"A",Calls_Handled:42,Talk_Time_min:3.6,Hold_Time_min:0.8,Handling_Time_min:4.4,CSAT_Score:86};
  const created=await fetch(base+"/api/agents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(record)});
  if(created.status!==201)throw new Error("Create agent endpoint returned "+created.status);
  const all=await (await fetch(base+"/api/agents")).json();
  if(all.total!==31)throw new Error("Expected 31 agents after create; got "+all.total);
  const metrics=await (await fetch(base+"/api/metrics")).json();
  if(metrics.totalAgents!==31)throw new Error("Metrics endpoint failed to reflect inserted agent");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6000);
  const stream=await fetch(base+"/api/stream",{signal:controller.signal});
  if(!stream.ok||!stream.body)throw new Error("SSE endpoint did not open");
  const reader=stream.body.getReader();
  let received="";
  while(!received.includes("event: update")){
    const part=await reader.read();
    if(part.done)break;
    received+=new TextDecoder().decode(part.value);
  }
  clearTimeout(timeout);
  controller.abort();
  if(!received.includes("event: update"))throw new Error("No live SSE update received");
  console.log("PASS: health, seeded dataset, create-agent API, metrics and SSE live updates.");
}finally{
  child.kill("SIGTERM");
  fs.rmSync(dataDir,{recursive:true,force:true});
}
