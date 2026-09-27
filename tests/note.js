/* Note → Codes: the screen a doctor actually pastes into.
   It used to run its own matcher and coded three things that were not true of
   the patient. These tests hold it to the measured engine. */
const {load,makeEnv}=require('./_harness.js');
const {code,html}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{analyzeNote,noteProblems,_stProblems,napiOn,napiBase,napiCfg,napiShape,'+
 'napiToggle,napiSave,napiRestore,ICD_MAP,window});');
const {t,done}=runnerLocal();
function runnerLocal(){const {runner}=require('./_harness.js');return runner();}

const run=n=>{reset();S('note-input').value=n;analyzeNote();return S('note-out').innerHTML;};
const codesOf=h=>Array.from(new Set(h.match(/\b[A-Z]\d{2}(?:\.\d+)?\b/g)||[])).join(',');

/* ---- the three wrong diagnoses this screen used to produce ---- */
const TRAP='45 year old man with community acquired pneumonia. Serial troponins negative, no myocardial infarction. '
 +'CT ruled out pulmonary embolism. Mother has breast cancer.';

t('the real diagnosis is still coded',()=>/J18/.test(run(TRAP))||'got '+codesOf(run(TRAP)));
t('a denied myocardial infarction is not coded',()=>!/I21/.test(run(TRAP))||'coded a denied MI');
t('a ruled-out pulmonary embolism is not coded',()=>!/I26/.test(run(TRAP))||'coded a ruled-out PE');
t('the mother\'s breast cancer is not the patient\'s',()=>!/C50/.test(run(TRAP))||'coded a family history');

/* ---- it agrees with the engine the corpus measures ---- */
const SAMPLES=[
 'Type 2 diabetes mellitus with a diabetic foot ulcer. Wound swab grew MRSA.',
 'Acute appendicitis. Pregnancy test negative. For laparoscopic appendicectomy.',
 'Cellulitis of the left leg. Blood cultures negative. On flucloxacillin.',
 'Chest pain, troponin negative, no myocardial infarction. Non cardiac chest pain.',
 'COPD exacerbation. No pneumothorax on chest x-ray. Started on prednisolone.',
 TRAP];
SAMPLES.forEach((n,i)=>{
 t('screen and engine agree on sample '+(i+1),()=>{
  const screen=noteProblems(n).map(x=>x.code).sort().join(',');
  const eng=_stProblems(n,' '+n.toLowerCase().replace(/\s+/g,' ')+' ').map(x=>x.code).sort().join(',');
  return screen===eng||'screen '+(screen||'(none)')+' vs engine '+(eng||'(none)');
 });
});

/* ---- a diagnosis followed by a negative test survives ---- */
t('a negative test in the NEXT sentence does not erase the diagnosis',()=>{
 const h=run('Community acquired pneumonia. Blood cultures negative.');
 return /J18/.test(h)||'lost the pneumonia: '+codesOf(h);});
t('a resolved symptom in the next sentence does not erase the diagnosis',()=>{
 const h=run('Community acquired pneumonia. Symptoms resolved on discharge.');
 return /J18/.test(h)||'lost the pneumonia: '+codesOf(h);});

/* ---- a note with nothing in it ---- */
t('an empty note asks for one',()=>{reset();S('note-input').value='';analyzeNote();
 return S('note-out').innerHTML.length>0;});
t('a note where everything is denied codes nothing and says why',()=>{
 const h=run('No chest pain. No shortness of breath. No fever. Denies palpitations.');
 return /No active diagnoses|Not coded, and why/.test(h)||'got '+codesOf(h);});

/* ══════════ the optional online service ══════════ */
t('the online service is offered in the page',()=>/id="napi-on"/.test(html)&&/id="napi-url"/.test(html));
t('it is off unless a doctor turns it on',()=>{reset();return napiOn()===false;});
t('turning it on without an address still uses the local engine',()=>{reset();
 S('napi-on').checked=true;S('napi-url').value='';
 return napiOn()===false||'went online with no address';});
t('turning it on with an address routes online',()=>{reset();
 S('napi-on').checked=true;S('napi-url').value='https://example.invalid';
 return napiOn()===true||'stayed local';});
t('a trailing slash in the address is tolerated',()=>{reset();
 S('napi-url').value='https://example.invalid/';
 return napiBase()==='https://example.invalid'||'got '+napiBase();});
t('the warning text is written where a doctor will read it',()=>
 /sends the note off this device/.test(html)||'no warning in the page');
t('the warning is hidden until the box is ticked',()=>
 /id="napi-warn"[^>]*style="display:none"/.test(html)||'the warning starts visible');
t('the choice is remembered between sessions',()=>{reset();
 S('napi-on').checked=true;S('napi-url').value='https://svc.example';napiSave();
 const c=napiCfg();return (c.on===true&&c.url==='https://svc.example')||'stored '+JSON.stringify(c);});

/* the service answer is mapped onto exactly the shape the local engine gives,
   so one renderer draws both */
t('a service answer maps onto the local shape',()=>{reset();
 const shaped=napiShape({
  principal:[{code:'J18.9',description:'Pneumonia, unspecified',evidence:{term:'community acquired pneumonia'}}],
  supporting:[{code:'R50.9',description:'Fever, unspecified',evidence:{term:'fever'}}],
  mentionedButNotCoded:[{code:'I21.9',term:'myocardial infarction'}]});
 if(shaped.length!==2)return 'got '+shaped.length+' codes';
 if(!shaped.every(x=>x.code&&x.term&&x.rec))return 'a mapped code is missing a field';
 return (window._stSkipped||[]).indexOf('myocardial infarction')>=0||'refusals were not carried across';});
t('a service code the local table does not know is dropped, not shown blank',()=>{reset();
 return napiShape({principal:[{code:'ZZ99.9',description:'not a real code',evidence:{term:'x'}}]}).length===0
  ||'kept an unknown code';});

done();
