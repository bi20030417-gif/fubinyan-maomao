import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public');const port=process.env.PORT||3000;
const safeError=(v)=>String(v||'').replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_KEY]').slice(0,180);
const sendJson=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(obj));};


const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
let modelCache={models:[],until:0};
const geminiBase='https://generativelanguage.googleapis.com/v1beta';
async function timedFetch(url,opts={},ms=18000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),ms);
 try{return await fetch(url,{...opts,signal:controller.signal})}
 finally{clearTimeout(timer)}
}
async function listModels(key){
 if(modelCache.until>Date.now())return modelCache.models;
 const r=await timedFetch(`${geminiBase}/models?pageSize=100`,{headers:{'x-goog-api-key':key}},10000);
 const data=await r.json().catch(()=>({}));
 if(!r.ok){console.error(`[Gemini] Model list failed status=${r.status} detail=${safeError(data.error?.message)}`);throw Error(`MODEL_LIST_${r.status}`)}
 const models=(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.replace(/^models\//,''));
 modelCache={models,until:Date.now()+20*60*1000};
 console.log(`[Gemini] Models available count=${models.length} flash=${models.filter(m=>m.includes('flash')).join(',').slice(0,350)}`);
 return models;
}
function chooseModel(models){
 const preferred=String(process.env.GEMINI_MODEL||'').replace(/^models\//,'');
 if(preferred&&models.includes(preferred)&&preferred!=='gemini-3.8-flash')return preferred;
 const preferredCandidates=['gemini-2.5-flash-lite','gemini-2.0-flash-lite','gemini-3-flash-preview','gemini-2.5-flash'];
 const chosen=preferredCandidates.find(x=>models.includes(x))||models.find(x=>/flash.*lite/.test(x))||models.find(x=>/flash/.test(x));
 if(!chosen)throw Error('NO_FLASH_MODEL');
 if(preferred)console.warn(`[Gemini] Configured model ${preferred} not in available model list; using ${chosen}`);
 return chosen;
}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/api/chat'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>60000){res.writeHead(413).end();return;}}
  try{
   const body=JSON.parse(raw),key=process.env.GEMINI_API_KEY?.trim();
   if(!key){console.error('[Gemini] GEMINI_API_KEY missing');sendJson(res,503,{mode:'offline',code:'KEY_MISSING',reply:null});return;}
   const name=String(body.character||'').slice(0,40),input=String(body.message||'').slice(0,900),context=String(body.context||'').slice(-3500);
   const prompt=`你是宜北高中校园故事中的${name}，只用简体中文微信短句自然回复，通常不加标点。不可代替玩家行动或说话，不可泄露其他人的私聊。不得自行透露付彬言病情或制造重大事故。人物设定与聊天背景：\n${context}\n玩家最新消息：${input}\n只输出该角色的回复`;
   let model;
   try{model=chooseModel(await listModels(key))}
   catch(e){const code=e.name==='AbortError'?'MODEL_LIST_TIMEOUT':safeError(e.message);console.error(`[Gemini] Model discovery failed code=${code}`);sendJson(res,502,{mode:'error',code,reply:null});return}
   const t=Date.now();
   console.log(`[Gemini] Request model=${model} timeoutMs=60000`);
   let r;
   try{r=await timedFetch(`${geminiBase}/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:900,temperature:0.85,...(model.startsWith('gemini-2.5-')?{thinkingConfig:{thinkingBudget:0}}:{})}})
   },60000)}
   catch(e){const code=e.name==='AbortError'?'TIMEOUT':'NETWORK_ERROR';console.error(`[Gemini] ${code} model=${model} elapsedMs=${Date.now()-t} detail=${safeError(e.message)}`);sendJson(res,502,{mode:'error',code,reply:null});return}
   const data=await r.json().catch(()=>({}));
   if(!r.ok){const code=String(data.error?.status||`HTTP_${r.status}`).replace(/[^A-Z0-9_]/g,'').slice(0,50);
    console.error(`[Gemini] API error status=${r.status} code=${code} model=${model} detail=${safeError(data.error?.message)}`);
    sendJson(res,502,{mode:'error',status:r.status,code,reply:null});return}
   const reply=data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();
   if(!reply){const code='EMPTY_RESPONSE';console.error(`[Gemini] ${code} model=${model} finish=${safeError(data.candidates?.[0]?.finishReason||data.promptFeedback?.blockReason)}`);sendJson(res,502,{mode:'error',code,reply:null});return}
   console.log(`[Gemini] OK model=${model} elapsedMs=${Date.now()-t}`);
   sendJson(res,200,{mode:'ai',reply});
  }catch(e){console.error(`[Gemini] SERVER_ERROR detail=${safeError(e.message)}`);sendJson(res,502,{mode:'error',code:'SERVER_ERROR',reply:null})}return;
 }
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname==='/')pathname='/index.html';const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end('Not found');}
});server.listen(port,'0.0.0.0',()=>console.log('宜北高中第二版 running on '+port));
