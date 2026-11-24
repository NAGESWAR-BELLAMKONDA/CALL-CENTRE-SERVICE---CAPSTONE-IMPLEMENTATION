import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import pg from "pg";
const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "runtime-store.json");
const SEED_FILE = path.join(__dirname, "data", "call_centre_agents.csv");
const APP_ORIGIN = process.env.APP_ORIGIN || "*";
const DEMO_INTERVAL_MS = Math.max(1200, Number(process.env.DEMO_INTERVAL_MS || 3500));
const UPSTREAM_URL = process.env.UPSTREAM_API_URL || "";
const UPSTREAM_KEY = process.env.UPSTREAM_API_KEY || "";
const INGEST_KEY = process.env.INGEST_API_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const UPSTREAM_POLL_MS = Math.max(10000, Number(process.env.UPSTREAM_POLL_MS || 30000));

app.disable("x-powered-by");
app.use(cors({ origin: APP_ORIGIN === "*" ? "*" : APP_ORIGIN.split(",").map(x => x.trim()), methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type","Authorization","X-Ingest-Key"] }));
app.use(express.json({ limit: "2mb" }));

const REQUIRED = ["Agent_ID","Group","Calls_Handled","Talk_Time_min","Hold_Time_min","Handling_Time_min","CSAT_Score"];
const numeric = ["Agent_ID","Calls_Handled","Talk_Time_min","Hold_Time_min","Handling_Time_min","CSAT_Score"];
let agents = [];
let events = [];
let clients = new Set();
let demoTimer = null;
let upstreamTimer = null;
let sourceMode = UPSTREAM_URL ? "connecting" : "demo";
let lastSourceSync = null;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false } }) : null;

function parseCsvLine(line) {
  const out=[]; let value="", quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){out.push(value);value="";}else value+=c;}
  out.push(value); return out;
}
function readSeed(){
  const raw=fs.readFileSync(SEED_FILE,"utf8").replace(/^\uFEFF/,"").trim().split(/\r?\n/);
  const headers=parseCsvLine(raw.shift()).map(x=>x.trim());
  return raw.filter(Boolean).map(line=>{const vals=parseCsvLine(line),o={};headers.forEach((h,i)=>o[h]=vals[i]);return normalize(o);}).filter(isValid);
}
function normalize(row){
  const r={Agent_ID:Number(row.Agent_ID),Group:String(row.Group||"").trim().toUpperCase(),Calls_Handled:Number(row.Calls_Handled),Talk_Time_min:Number(row.Talk_Time_min),Hold_Time_min:Number(row.Hold_Time_min),Handling_Time_min:Number(row.Handling_Time_min),CSAT_Score:Number(row.CSAT_Score)};
  if(row.updated_at) r.updated_at=row.updated_at;
  if(row.status) r.status=String(row.status);
  return r;
}
function isValid(r){return Number.isInteger(r.Agent_ID)&&r.Agent_ID>0&&["A","B"].includes(r.Group)&&numeric.slice(1).every(k=>Number.isFinite(r[k])&&r[k]>=0)&&r.CSAT_Score<=100;}
function persist(){fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(STORE_FILE,JSON.stringify({agents,events:events.slice(0,250),lastSourceSync},null,2));if(pool)persistDatabase().catch(err=>console.error("PostgreSQL persistence error:",err.message));}
async function persistDatabase(){
  for(const agent of agents) await pool.query("INSERT INTO agent_records(agent_id,data,updated_at) VALUES($1,$2::jsonb,NOW()) ON CONFLICT(agent_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()",[agent.Agent_ID,JSON.stringify(agent)]);
  for(const event of events.slice(0,250)) await pool.query("INSERT INTO audit_events(event_id,data,created_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(event_id) DO NOTHING",[event.id,JSON.stringify(event),event.at]);
  await pool.query("DELETE FROM audit_events WHERE created_at < NOW() - INTERVAL '30 days'");
}
async function initDatabase(){
  await pool.query("CREATE TABLE IF NOT EXISTS agent_records(agent_id BIGINT PRIMARY KEY,data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS audit_events(event_id UUID PRIMARY KEY,data JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  const result=await pool.query("SELECT data FROM agent_records ORDER BY agent_id");
  if(result.rows.length){agents=result.rows.map(row=>normalize(row.data)).filter(isValid);}
  else {for(const agent of agents)await pool.query("INSERT INTO agent_records(agent_id,data) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING",[agent.Agent_ID,JSON.stringify(agent)]);}
  const history=await pool.query("SELECT data FROM audit_events ORDER BY created_at DESC LIMIT 250");
  if(history.rows.length)events=history.rows.map(row=>row.data);
  console.log("PostgreSQL connected; loaded "+agents.length+" agent records.");
}
function load(){try{const saved=JSON.parse(fs.readFileSync(STORE_FILE,"utf8"));if(Array.isArray(saved.agents)&&saved.agents.length){agents=saved.agents.map(normalize).filter(isValid);events=Array.isArray(saved.events)?saved.events:[];lastSourceSync=saved.lastSourceSync||null;return;}}catch{}agents=readSeed();events=[];persist();}
function publicEvent(type,payload){const event={id:crypto.randomUUID(),type,at:new Date().toISOString(),payload};events.unshift(event);events=events.slice(0,250);const wire="event: update\ndata: "+JSON.stringify(event)+"\n\n";for(const res of clients){try{res.write(wire);}catch{clients.delete(res);}}persist();return event;}
function snapshot(){return {agents,events:events.slice(0,50),sourceMode,lastSourceSync,serverTime:new Date().toISOString()};}
function summary(rows=agents){const out={totalAgents:rows.length,totalCalls:rows.reduce((s,r)=>s+r.Calls_Handled,0),groups:{A:rows.filter(r=>r.Group==="A").length,B:rows.filter(r=>r.Group==="B").length},metrics:{}};for(const key of REQUIRED.slice(2)){const a=rows.filter(r=>r.Group==="A").map(r=>r[key]),b=rows.filter(r=>r.Group==="B").map(r=>r[key]);const mean=x=>x.length?x.reduce((s,v)=>s+v,0)/x.length:0;const sd=x=>x.length>1?Math.sqrt(x.reduce((s,v)=>s+(v-mean(x))**2,0)/(x.length-1)):0;out.metrics[key]={A:{n:a.length,mean:mean(a),sd:sd(a)},B:{n:b.length,mean:mean(b),sd:sd(b)}};}return out;}
function addAgent(input){const r=normalize(input);if(!isValid(r))throw Object.assign(new Error("Invalid agent record. Check required fields, group A/B and CSAT range 0–100."),{status:400});if(agents.some(x=>x.Agent_ID===r.Agent_ID))throw Object.assign(new Error("Agent_ID already exists."),{status:409});r.updated_at=new Date().toISOString();agents.push(r);publicEvent("agent.created",r);return r;}
function startDemo(){if(demoTimer)return;sourceMode="demo";demoTimer=setInterval(()=>{if(!agents.length)return;const base=agents[Math.floor(Math.random()*agents.length)];const r={...base,Calls_Handled:Math.max(0,base.Calls_Handled+(Math.random()<.75?1:0)),Talk_Time_min:Number(Math.max(.5,base.Talk_Time_min+(Math.random()-.5)*.25).toFixed(2)),Hold_Time_min:Number(Math.max(0,base.Hold_Time_min+(Math.random()-.5)*.12).toFixed(2)),Handling_Time_min:Number(Math.max(.5,base.Handling_Time_min+(Math.random()-.5)*.22).toFixed(2)),CSAT_Score:Math.min(100,Math.max(0,Math.round(base.CSAT_Score+(Math.random()-.5)*2))),updated_at:new Date().toISOString(),status:["Available","On call","After call work"][Math.floor(Math.random()*3)]};const idx=agents.findIndex(x=>x.Agent_ID===r.Agent_ID);agents[idx]=r;publicEvent("agent.updated",r);},DEMO_INTERVAL_MS);}
function stopDemo(){if(demoTimer){clearInterval(demoTimer);demoTimer=null;}if(!UPSTREAM_URL)sourceMode="manual";}
function mapUpstream(payload){const rows=Array.isArray(payload)?payload:(payload?.data||payload?.agents||payload?.records||[]);if(!Array.isArray(rows))throw new Error("Upstream response must be an array or contain data/agents/records array.");return rows.map(x=>normalize({...x,Agent_ID:x.Agent_ID??x.agentId??x.agent_id,Group:x.Group??x.group,Calls_Handled:x.Calls_Handled??x.callsHandled??x.calls_handled,Talk_Time_min:x.Talk_Time_min??x.talkTimeMin??x.talk_time_min,Hold_Time_min:x.Hold_Time_min??x.holdTimeMin??x.hold_time_min,Handling_Time_min:x.Handling_Time_min??x.handlingTimeMin??x.handling_time_min,CSAT_Score:x.CSAT_Score??x.csatScore??x.csat_score})).filter(isValid);}
async function pollUpstream(){if(!UPSTREAM_URL)return;try{sourceMode="api";const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);const res=await fetch(UPSTREAM_URL,{headers:{Accept:"application/json",...(UPSTREAM_KEY?{Authorization:"Bearer "+UPSTREAM_KEY}: {})},signal:controller.signal});clearTimeout(timer);if(!res.ok)throw new Error("Upstream API returned HTTP "+res.status);const payload=await res.json();const rows=mapUpstream(payload);if(!rows.length)throw new Error("No valid agent records received from upstream API.");agents=rows;lastSourceSync=new Date().toISOString();publicEvent("source.synced",{count:rows.length,source:"external-api"});sourceMode="api";}catch(err){sourceMode="api-error";publicEvent("source.error",{message:err.message});}}
function requireIngest(req,res,next){if(!INGEST_KEY)return res.status(503).json({error:"INGEST_API_KEY is not configured on this server."});const key=req.get("X-Ingest-Key")||req.get("Authorization")?.replace(/^Bearer\s+/i,"");if(key!==INGEST_KEY)return res.status(401).json({error:"Invalid ingestion key."});next();}

load();
(async()=>{try{if(pool)await initDatabase();if(UPSTREAM_URL){await pollUpstream();upstreamTimer=setInterval(pollUpstream,UPSTREAM_POLL_MS);}else startDemo();}catch(err){console.error("Startup data initialisation failed:",err.message);if(!UPSTREAM_URL)startDemo();}})();

app.get("/api/health",(req,res)=>res.json({ok:true,service:"CALLCENTRE IQ API",version:"1.0.0",mode:sourceMode,agents:agents.length,lastSourceSync,uptimeSeconds:Math.round(process.uptime()),serverTime:new Date().toISOString()}));
app.get("/api/config",(req,res)=>res.json({mode:sourceMode,upstreamConfigured:Boolean(UPSTREAM_URL),databaseConfigured:Boolean(pool),demoRunning:Boolean(demoTimer),lastSourceSync,ingestEnabled:Boolean(INGEST_KEY)}));
app.get("/api/agents",(req,res)=>res.json({data:agents,total:agents.length,sourceMode}));
app.get("/api/agents/:id",(req,res)=>{const r=agents.find(x=>String(x.Agent_ID)===req.params.id);r?res.json(r):res.status(404).json({error:"Agent not found"});});
app.post("/api/agents",(req,res,next)=>{try{const r=addAgent(req.body);res.status(201).json({data:r});}catch(e){next(e);}});
app.post("/api/agents/bulk",(req,res,next)=>{try{const rows=Array.isArray(req.body?.data)?req.body.data:req.body;if(!Array.isArray(rows)||!rows.length)return res.status(400).json({error:"Send a non-empty JSON array or {data:[...]}."});const clean=rows.map(normalize);const ids=new Set(agents.map(x=>x.Agent_ID));for(const r of clean){if(!isValid(r))throw Object.assign(new Error("Bulk import contains an invalid record."),{status:400});if(ids.has(r.Agent_ID))throw Object.assign(new Error("Duplicate Agent_ID "+r.Agent_ID+" found."),{status:409});ids.add(r.Agent_ID);}agents=clean;publicEvent("dataset.replaced",{count:agents.length});res.json({success:true,count:agents.length});}catch(e){next(e);}});
app.get("/api/metrics",(req,res)=>res.json(summary()));
app.get("/api/events",(req,res)=>res.json({data:events.slice(0,Number(req.query.limit||50))}));
app.get("/api/stream",(req,res)=>{res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"});res.write("retry: 3000\n\nevent: connected\ndata: "+JSON.stringify({mode:sourceMode,at:new Date().toISOString()})+"\n\n");clients.add(res);req.on("close",()=>clients.delete(res));});
app.post("/api/demo/start",(req,res)=>{startDemo();res.json({success:true,running:Boolean(demoTimer),mode:sourceMode});});
app.post("/api/demo/stop",(req,res)=>{stopDemo();res.json({success:true,running:Boolean(demoTimer),mode:sourceMode});});
app.post("/api/integrations/ingest",requireIngest,(req,res,next)=>{try{const rows=Array.isArray(req.body?.data)?req.body.data:[req.body];const clean=rows.map(normalize);if(clean.some(x=>!isValid(x)))throw Object.assign(new Error("Payload contains invalid records."),{status:400});for(const r of clean){const i=agents.findIndex(x=>x.Agent_ID===r.Agent_ID);if(i>=0){agents[i]={...r,updated_at:new Date().toISOString()};publicEvent("agent.updated",agents[i]);}else addAgent(r);}res.json({success:true,accepted:clean.length});}catch(e){next(e);}});
app.get("/api/report",(req,res)=>res.json({generatedAt:new Date().toISOString(),title:"Call-Centre Service Performance Analysis Using t-Test for Difference of Means",summary:summary(),sourceMode,disclaimer:"This API reports the current demonstration or configured upstream dataset. Statistical hypothesis testing is performed in the browser using the selected independent-samples t-test."}));
app.use(express.static(__dirname,{extensions:["html"]}));
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||500).json({error:err.message||"Internal server error"});});
app.listen(PORT,"0.0.0.0",()=>console.log("CALLCENTRE IQ API listening on "+PORT+" | mode="+sourceMode));
