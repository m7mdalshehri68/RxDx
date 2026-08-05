const fs=require('fs');const path=require('path');
function _rxFind(){ if(process.env.RXDX_HTML&&fs.existsSync(process.env.RXDX_HTML))return process.env.RXDX_HTML;
 for(const p of [path.join(__dirname,'..','index.html'),path.join(__dirname,'..','RxDx.html'),
   '/sessions/busy-elegant-allen/mnt/outputs/RxDx.html']) if(fs.existsSync(p))return p;
 throw new Error('RxDx html not found. Set RXDX_HTML.'); }
const code=require('./_harness.js').load().code;
function el(id){var o={id:id,value:'',innerHTML:'',className:'',checked:false,style:{},options:[],_attr:{},_kids:[],parentNode:{insertBefore(){}},classList:{add(){},remove(){},toggle(){},contains:()=>false},appendChild(){},addEventListener(){},focus(){},click(){},remove(){},scrollIntoView(){},getAttribute:n=>o._attr[n]||null,setAttribute:(n,v)=>{o._attr[n]=String(v);},removeAttribute(){},querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null};return o;}
var store={},sel={};function S(id){if(!store[id])store[id]=el(id);return store[id];}
global.document={getElementById:id=>S(id),querySelectorAll:()=>[],querySelector:()=>null,createElement:t=>el(t),addEventListener(){},body:{classList:{add(){},remove(){},toggle:()=>true},appendChild(){}}};
global.window=global;global.navigator={clipboard:{writeText(){}},onLine:true};global.location={reload(){}};
var _ls={};global.localStorage={getItem:()=>null,setItem(){},removeItem(){},hasOwnProperty:()=>false};
global.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.alert=()=>{};global.confirm=()=>true;global.prompt=()=>'';global.setInterval=()=>1;
global.setTimeout=(f)=>{if(typeof f==='function'){try{f();}catch(_){}}return 1;};global.clearTimeout=()=>{};
global.fetch=()=>Promise.reject(0);global.Blob=function(){};global.URL={createObjectURL:()=>'x',revokeObjectURL(){}};
eval(code+'\n;Object.assign(global,{_stProblems,CXPLUS,PLANCX,rxNetPaint,rxNetCheck,_stSkipNote});');
let P=0,F=0;const t=(n,f)=>{try{const r=f();if(r===true||r===undefined)P++;else{F++;console.log('  FAIL',n,'→',r);}}catch(err){F++;console.log('  ERR ',n,'→',err.message);}};
const codes=(note)=>{const low=' '+note.toLowerCase().replace(/\s+/g,' ')+' ';
 return _stProblems(note,low).map(x=>x.code+' '+x.desc);};
const has=(note,rx)=>codes(note).some(c=>rx.test(c));

t('THE BUG: a denied symptom is not coded',()=>!has('Patient denies fever. Cough for 3 days.',/fever/i)||('coded: '+codes('Patient denies fever. Cough for 3 days.')));
t('but the symptom the patient does have is coded',()=>has('Patient denies fever. Cough for 3 days.',/cough/i));
t('"no chest pain" is not coded',()=>!has('No chest pain. Abdominal pain since morning.',/chest pain/i));
t('"without fever" is not coded',()=>!has('Sore throat without fever.',/fever/i));
t('"negative for" is not coded',()=>!has('Negative for haematuria.',/haematuria|hematuria/i));
t('"ruled out" is not coded',()=>!has('Pulmonary embolism ruled out on CTPA.',/pulmonary embolism/i));
t('"afebrile" does not code fever',()=>!has('Patient is afebrile and well.',/fever/i));
t('"no evidence of" is not coded',()=>!has('No evidence of pneumonia on the film.',/pneumonia/i));
t('"resolved" is not coded',()=>!has('Vomiting resolved.',/vomiting/i));
t('a negation does not leak past a full stop',()=>has('No fever. Chest pain since 2 hours.',/chest pain/i));
t('a negation does not leak past a line break',()=>has('Denies headache\nAbdominal pain present',/abdominal pain/i));
t('family history is not the patient diagnosis',()=>!has('Family history of diabetes mellitus.',/diabetes/i));
t('the father\'s disease is not the patient\'s',()=>!has('Father had myocardial infarction at 50.',/myocardial infarction/i));
t('"to exclude" is not a diagnosis',()=>!has('CT head to exclude subarachnoid haemorrhage.',/subarachnoid/i));
t('"suspected" is not a confirmed code',()=>!has('Suspected appendicitis, for review.',/appendicitis/i));
t('a plain positive statement is still coded',()=>has('Diagnosis: type 2 diabetes mellitus.',/diabetes/i));
t('a list of positives all get coded',()=>{const c=codes('Type 2 diabetes mellitus and essential hypertension.');
 return c.some(x=>/diabetes/i.test(x))&&c.some(x=>/hypertension/i.test(x));});
t('"fever: no" is not coded',()=>!has('Fever: no. Cough: yes.',/fever/i));
t('the skipped terms are recorded for the doctor',()=>{codes('Patient denies fever.');
 return (window._stSkipped||[]).length>0;});
t('an empty note codes nothing',()=>codes('').length===0);
t('the junk differential layer is gone',()=>Object.keys(CXPLUS.ddx||{}).length===0&&Object.keys(CXPLUS.red||{}).length===0);

// ── the connection light: honest, or it says nothing ──
t('it starts as not verified, never as online',()=>{const {html}=require('./_harness.js').load();
 return /rxNetPaint\('unknown','Checking/.test(html);});
t('offline still says the tool keeps working',()=>{
 global.location={protocol:'https:',host:'h',pathname:'/a'};
 global.navigator.onLine=false;rxNetCheck();global.navigator.onLine=true;
 return /continue to work/i.test(S('rx-net').title||'');});
t('a local file is told the truth about itself',()=>{
 global.location={protocol:'file:'};rxNetCheck();
 return /cannot be tested/i.test(S('rx-net').title||'');});
t('the doctor is told what was left out',()=>{
 _stProblems('Patient denies fever.',' patient denies fever. ');
 return /Not coded, and why/.test(_stSkipNote());});
t('nothing skipped, nothing said',()=>{
 _stProblems('Type 2 diabetes mellitus.',' type 2 diabetes mellitus. ');
 return _stSkipNote()==='';});
console.log(P+' passed, '+F+' failed');process.exit(F?1:0);
