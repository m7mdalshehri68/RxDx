/* Negation, family history and the connection light. Loads the tool through
   the shared harness, so it runs on the web build (tables in data/*.js) as
   well as a single-file build. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S}=makeEnv();
eval(code+'\n;Object.assign(global,{_stProblems,CXPLUS,PLANCX,rxNetPaint,rxNetCheck,_stSkipNote});');
const {t,done}=runner();
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

// ── the connection light ──
t('and red when offline',()=>{global.navigator.onLine=false;rxNetCheck();
 const e=S('rx-net');return /\boff\b/.test(e.className)&&/Offline/.test(e.innerHTML);});
/* the offline explanation lives in the light's tooltip */
t('offline still says the tool works',()=>{global.navigator.onLine=false;rxNetCheck();
 return /continue to work/i.test(S('rx-net').title||'');});
t('the doctor is told what was left out',()=>{
 _stProblems('Patient denies fever.',' patient denies fever. ');
 return /Not coded, and why/.test(_stSkipNote());});
t('nothing skipped, nothing said',()=>{
 _stProblems('Type 2 diabetes mellitus.',' type 2 diabetes mellitus. ');
 return _stSkipNote()==='';});
/* Online is no longer read from navigator.onLine, which reports a cable or a
   radio, not the internet (it showed green while offline). The light turns
   green only when a probe reaches the server, and that answer arrives
   asynchronously, so these checks wait for it. */
(async()=>{
 const settle=()=>new Promise(r=>setImmediate(r));
 await settle();   /* the page probes once when it loads; let that one finish first */
 global.navigator.onLine=true;global.fetch=()=>Promise.resolve({ok:true});
 rxNetCheck();await settle();
 t('the light shows green when online',()=>{
  const e=S('rx-net');return /\bon\b/.test(e.className)&&/Online/.test(e.innerHTML);});
 t('it reassures that data never leaves the device',()=>/never leaves this device/i.test(S('rx-net').title||''));
 global.fetch=()=>Promise.reject(0);
 rxNetCheck();await settle();
 t('a network cable without internet is not shown as online',()=>/\boff\b/.test(S('rx-net').className));
 done();
})();
