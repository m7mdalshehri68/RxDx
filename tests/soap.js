/* SOAP and SOCRATES layouts of the clinic and emergency notes. The SOAP layout
   may only move and join what the doctor entered: every test here either feeds
   it a known encounter and checks each fact comes out once, in the right
   section, or checks that nothing comes out that was not put in. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,sel,reset}=makeEnv();
eval(code+';Object.assign(global,{hxHpiText,hxSoapText,hxNoteModel,edSoapText,hxGenerate,hxDxAdd,hxDxToDiff,hxDiffToDx,hxDxPrimary,'+
 'noteFmt,noteFmtSet,noteFmtClear,_snSiteClause,_snDur,_snLc,_snSec,hxExamSystem,hxPregApplies,hxPregData,hxChiData,_hxAllText,'+
 'noteProblems,hxScoreExtra,cfgMissing,CFG_FIELDS,hxRedSync,hxRedNone,hxPick1,whoYears,whoSex,PRESENTATIONS,EXAM});');
const {t,done}=runner();
const fill=(id,v)=>{S(id).value=v;};
const row=(t,s,d)=>{const o={_attr:{'data-t':t,'data-state':s},getAttribute(n){return this._attr[n]===undefined?null:this._attr[n];},textContent:t};if(d)o._attr['data-d']=d;return o;};
const base=()=>({stage:'final',ovr:'',cc:'Chest pain',pain:true,who:{age:45,unit:'y',years:45,sex:'Male'},
 hpc:{onset:'Sudden onset',duration:'2 days',site:'Central chest',character:'Pressure / heavy',radiation:'To left arm',
  course:'Constant',exac:'Exertion',reliev:'Rest',severity:'7–8 severe'},
 reports:['sweating (diaphoresis)','nausea or vomiting'],denies:['shortness of breath'],red:[],redNone:true,injury:null,
 bg:{pmh:'Hypertension',dhx:'Amlodipine 5 mg daily',allergy:'NKDA',fhx:'',screen:[],shx:'Non-smoker',ice:''},preg:null,
 gen:'Alert, not in distress',vitals:'Haemodynamically stable',
 exam:[{t:'Heart sounds',s:'1',d:''},{t:'Breath sounds',s:'2',d:'crackles right base'}],results:'Troponin 6 ng/L',
 impression:'Likely unstable angina.',dx:[{code:'I20.0',desc:'Unstable angina'},{code:'I10',desc:'Essential (primary) hypertension'}],
 ddx:[{code:'I26.9',desc:'Pulmonary embolism without mention of acute cor pulmonale'}],
 claim:[],inv:[],mds:[],tools:['HEART score — chest pain: 4/10 — moderate risk'],clin:[],morph:[],nec:[],
 plan:{ix:'Repeat troponin',rx:'Aspirin 300 mg',ref:'Refer to emergency department',fu:'Review with results',adv:'Safety netting explained'}});
const section=(txt,h)=>{const L=txt.split('\n'),i=L.indexOf(h);if(i<0)return '';const out=[];for(let k=i+1;k<L.length&&L[k]!=='';k++)out.push(L[k]);return out.join('\n');};

/* ---------- the history paragraph ---------- */
t('the history reads as one paragraph built only from the fields',()=>{
 const h=hxHpiText(base());
 const want=['45-year-old male presenting with a 2-day history of chest pain.','Onset was sudden.',
  'It is located in the central chest, radiating to the left arm.','The pain is pressure / heavy in character.',
  'It is constant.','It is worse with exertion and relieved by rest.','Severity 7–8/10 (severe).',
  'Associated with sweating (diaphoresis) and nausea or vomiting.','Denies shortness of breath.'];
 const miss=want.filter(w=>h.indexOf(w)<0);
 return !miss.length||('missing: '+miss.join(' | ')+' in: '+h);});
t('an empty field adds no clause',()=>{
 const m=base();m.hpc={onset:'',duration:'',site:'',character:'',radiation:'',course:'',exac:'',reliev:'',severity:''};m.reports=[];m.denies=[];
 const h=hxHpiText(m);return h==='45-year-old male presenting with chest pain.'||h;});
t('no age or sex: the patient is not given one',()=>{
 const m=base();m.who={};return /^Patient presenting with/.test(hxHpiText(m))||hxHpiText(m);});
t('sex without age, and an age in months',()=>{
 const a=base();a.who={sex:'Female'};const b=base();b.who={age:8,unit:'mo',years:8/12,sex:'Male'};
 return /^Female patient presenting/.test(hxHpiText(a))&&/^8-month-old male presenting/.test(hxHpiText(b))||[hxHpiText(a),hxHpiText(b)].join(' | ');});
t('"an" before 8, 11 and 18',()=>_snDur('8 days')==='an 8-day history of'&&_snDur('11 weeks')==='an 11-week history of'&&_snDur('1 day')==='a 1-day history of'||_snDur('8 days'));
t('a duration it cannot read is kept as written',()=>{const m=base();m.hpc.duration='since Ramadan';
 return /presenting with chest pain \(duration: since Ramadan\)\./.test(hxHpiText(m))||hxHpiText(m);});
t('sites read naturally and keep their side',()=>{
 const c=[['Loin — right','is located in the right loin'],['Neck — front','is located in the front of the neck'],
  ['Epigastric','is located in the epigastric region'],['Between shoulder blades','is located between the shoulder blades'],
  ['Generalised','is generalised'],['Multiple sites','affects multiple sites'],['Right lower quadrant','is located in the right lower quadrant']];
 const bad=c.filter(x=>_snSiteClause(x[0])!==x[1]).map(x=>x[0]+' -> '+_snSiteClause(x[0]));
 return !bad.length||bad.join(' | ');});
t('no radiation, nothing relieves, a bare number for severity',()=>{
 const m=base();m.hpc.radiation='None';m.hpc.reliev='Nothing helps';m.hpc.severity='6';m.hpc.exac='';
 const h=hxHpiText(m);
 return /central chest, with no radiation\./.test(h)&&/Nothing relieves it\./.test(h)&&/Severity 6\/10\./.test(h)&&!/relieved by/.test(h)||h;});
t('a symptom that is not pain is not called "the pain"',()=>{
 const m=base();m.pain=false;m.cc='Cough';m.hpc.site='';m.hpc.radiation='';m.hpc.severity='';m.hpc.character='Dry, Worse at night';
 const h=hxHpiText(m);return !/pain/i.test(h)&&/Described as dry and worse at night\./.test(h)&&/Symptoms are constant\./.test(h)||h;});
t('acronyms and mixed case keep their case',()=>_snLc('HbA1c raised')==='HbA1c raised'&&_snLc('COPD')==='COPD'&&_snLc('Sharp')==='sharp'&&_snLc('I')==='I');

/* ---------- the SOAP layout ---------- */
t('four sections, in order, with the facts in the right one',()=>{
 const x=hxSoapText(base());
 const hs=['SUBJECTIVE','OBJECTIVE','ASSESSMENT','PLAN'].map(h=>x.split('\n').indexOf(h));
 if(hs.some(i=>i<0)||hs.some((v,i)=>i&&v<=hs[i-1]))return 'headers '+hs.join(',');
 const S_=section(x,'SUBJECTIVE'),O_=section(x,'OBJECTIVE'),A_=section(x,'ASSESSMENT'),P_=section(x,'PLAN');
 const chk=[[S_,'Chief Complaint: Chest pain'],[S_,'Red Flags: screened — none present'],[S_,'Medications: Amlodipine 5 mg daily'],
  [S_,'Social History: Non-smoker'],[O_,'General Appearance: Alert, not in distress'],[O_,'Vital Signs: Haemodynamically stable'],
  [O_,'  Respiratory: Breath sounds ABNORMAL — crackles right base'],[O_,'  Cardiovascular: Heart sounds normal'],[O_,'Results: Troponin 6 ng/L'],
  [A_,'Clinical Impression: Likely unstable angina.'],[A_,'Primary Diagnosis: Unstable angina'],[A_,'Secondary Diagnoses: Essential (primary) hypertension'],
  [A_,'Differential Diagnosis: Pulmonary embolism without mention of acute cor pulmonale'],[A_,'  - HEART score — chest pain: 4/10 — moderate risk'],
  [P_,'Investigations: Repeat troponin'],[P_,'Treatment: Aspirin 300 mg'],[P_,'Follow-up: Review with results']];
 const miss=chk.filter(c=>c[0].split('\n').indexOf(c[1])<0).map(c=>c[1]);
 return !miss.length||('missing: '+miss.join(' | '));});
t('the plan runs workup, treatment, advice, disposition, follow-up',()=>{
 const P_=section(hxSoapText(base()),'PLAN').split('\n').map(l=>l.split(':')[0]);
 return JSON.stringify(P_)===JSON.stringify(['Investigations','Treatment','Advice / Education','Referral / Disposition','Follow-up'])||P_.join(',');});
t('an empty section leaves no header',()=>{
 const m=base();m.gen='';m.vitals='';m.exam=[];m.results='';
 const x=hxSoapText(m);return x.split('\n').indexOf('OBJECTIVE')<0||x;});
t('a field left empty leaves no trace — no "Not documented", no empty label',()=>{
 const m=base();m.bg={pmh:'',dhx:'',allergy:'',fhx:'',screen:[],shx:'',ice:''};m.impression='';m.ddx=[];m.tools=[];
 const x=hxSoapText(m);
 return !/not documented|undefined|null|\[object/i.test(x)&&!/:\s*$/m.test(x.replace(/^Physical Examination:$/m,''))||x;});
t('one diagnosis is the primary and there is no secondary line',()=>{
 const m=base();m.dx=[m.dx[0]];const A_=section(hxSoapText(m),'ASSESSMENT');
 return /Primary Diagnosis: Unstable angina/.test(A_)&&!/Secondary/.test(A_)||A_;});
t('no codes are printed in the note',()=>!/\bI20\.0\b|\bI10\b|\bI26\.9\b/.test(hxSoapText(base()))||'a code was printed');
t('an interim note says so, and a documented override is kept',()=>{
 const m=base();m.stage='interim';m.ovr='patient left before results';const x=hxSoapText(m);
 return /^INTERIM ASSESSMENT NOTE/.test(x)&&/\(Interim note — assessment in progress\.\)/.test(x)&&/DOCUMENTED REASON FOR FINALISING WITH OUTSTANDING ITEMS: patient left before results/.test(x)||x;});
t('payer and chronic-disease answers go to history, results or assessment',()=>{
 const m=base();
 m.claim=[{name:'Type 2 diabetes',l:'Duration since diagnosis',id:'dmdur',v:'6 years'},{name:'Type 2 diabetes',l:'Last HbA1c + date',id:'dma1c',v:'8.4% Oct 2026'},
  {name:'Asthma',l:'Control level',id:'asctrl',v:'partly controlled'}];
 m.mds=[{sec:_snSec('Echocardiogram report — attached'),txt:'Chest pain · Echocardiogram report — attached — done today'},
  {sec:_snSec('Documented first-line oral therapy for 3 months, with failure to reach the therapeutic target'),txt:'DM · first-line — metformin 6 months'},
  {sec:_snSec('What is the HEART score? A risk stratification tool must be included.'),txt:'Chest pain · HEART — 4'}];
 const x=hxSoapText(m),S_=section(x,'SUBJECTIVE'),O_=section(x,'OBJECTIVE'),A_=section(x,'ASSESSMENT');
 return /Type 2 diabetes · Duration since diagnosis: 6 years/.test(S_)&&/Last HbA1c \+ date: 8\.4%/.test(O_)&&/Control level: partly controlled/.test(A_)
  &&/Echocardiogram report/.test(O_)&&/first-line — metformin/.test(S_)&&/HEART — 4/.test(A_)||x;});
t('payer questions are sorted the way a clinician would',()=>{
 const c=[['Serial high-sensitivity troponin I — done and reported','O'],['Current medication, its duration, and the patient\'s compliance — all three stated','S'],
  ['Is this cardiogenic or non-cardiogenic chest pain? State which, per AHA guidance.','A'],['HbA1c result, together with the therapeutic target set for this patient','O'],
  ['Documented failure on oral lipid-lowering therapy at the maximum tolerated dose','S'],['Risk stratification of the patient, with the therapeutic target that goes with it','A'],
  ['How long has the complaint lasted, and are there yellow flags or red flag signs','S']];
 const bad=c.filter(x=>_snSec(x[0])!==x[1]).map(x=>x[0].slice(0,40)+' -> '+_snSec(x[0]));
 return !bad.length||bad.join(' | ');});
t('examination items are grouped under the system they were listed in',()=>
 hxExamSystem('Heart sounds')==='Cardiovascular'&&hxExamSystem('Breath sounds')==='Respiratory'&&hxExamSystem('Power')==='Neurological'&&hxExamSystem('Unknown thing')==='Other'||hxExamSystem('Power'));

/* ---------- the builder end to end, in the stub page ---------- */
t('Generate fills both layouts and shows the chosen one',()=>{reset();
 fill('hx-input','Chest pain');fill('hx-onset','Sudden onset');fill('hx-duration','2 days');fill('hx-results','ECG sinus rhythm');
 fill('hx-impression','Probable angina.');fill('hx-plan-rx','Aspirin 300 mg');fill('hx-red-none-v','1');fill('hx-gen','In pain');
 sel['#hx-exam .hx-qrow']=[row('Breath sounds','2','wheeze bilaterally'),row('Heart sounds','1')];
 window._hxWho={age:60,unit:'y',years:60,sex:'Male'};
 hxDxAdd('I20.0');hxDxAdd('I26.9');hxDxToDiff('I26.9');
 noteFmt('hx','soap');hxGenerate('final');
 const tx=window._noteTxt.hx;if(!tx)return 'no layouts';
 const ok=S('hx-out').value===tx.soap&&/^SUBJECTIVE/.test(tx.soap)&&/^PRESENTING COMPLAINT: Chest pain/.test(tx.socrates);
 noteFmt('hx','socrates');const ok2=S('hx-out').value===tx.socrates;noteFmt('hx','soap');
 return ok&&ok2||[tx.soap,tx.socrates].join('\n=====\n');});
t('the SOCRATES layout carries the new fields too',()=>{
 const x=window._noteTxt.hx.socrates;
 const want=['RED FLAGS: screened — none present','  - General appearance: In pain','  - ABNORMAL: Breath sounds — wheeze bilaterally','RESULTS: ECG sinus rhythm',
  'CLINICAL IMPRESSION: Probable angina.','IMPRESSION / WORKING DIAGNOSIS: Unstable angina','DIFFERENTIAL DIAGNOSIS: Pulmonary embolism without mention of acute cor pulmonale'];
 const miss=want.filter(w=>x.split('\n').indexOf(w)<0);return !miss.length||('missing: '+miss.join(' | ')+'\n'+x);});
t('every fact in one layout is in the other',()=>{
 const tx=window._noteTxt.hx,facts=['Chest pain','Sudden','2','ECG sinus rhythm','Probable angina.','Aspirin 300 mg','In pain','wheeze bilaterally','Unstable angina','Pulmonary embolism'];
 const lo=s=>s.toLowerCase(),miss=facts.filter(f=>lo(tx.soap).indexOf(lo(f))<0||lo(tx.socrates).indexOf(lo(f))<0);return !miss.length||miss.join(', ');});
t('a cancelled generate clears both layouts',()=>{
 global.prompt=()=>null;fill('hx-input','Chest pain');
 const keep=global.cfgMissing;global.cfgMissing=()=>['Duration'];
 try{hxGenerate('final');}finally{global.prompt=()=>'documented reason';global.cfgMissing=keep;}
 return (window._noteTxt.hx===null&&S('hx-out').value==='')||'layouts survived a cancelled generate';});
t('a differential is never coded, a diagnosis made from it is',()=>{reset();
 hxDxAdd('I20.0');hxDxAdd('I26.9');hxDxToDiff('I26.9');
 const a=(window._hxDx||[]).map(x=>x.code).join(),b=(window._hxDiff||[]).map(x=>x.code).join();
 hxDiffToDx('I26.9');const c=(window._hxDx||[]).map(x=>x.code).join();
 hxDxPrimary('I26.9');const d=window._hxDx[0].code;
 return a==='I20.0'&&b==='I26.9'&&c==='I20.0,I26.9'&&d==='I26.9'||[a,b,c,d].join(' | ');});
t('adding a code that sits in the differentials moves it, it is not in both',()=>{reset();
 hxDxAdd('I26.9');hxDxToDiff('I26.9');hxDxAdd('I26.9');
 return (window._hxDiff||[]).length===0&&(window._hxDx||[]).length===1||JSON.stringify([window._hxDx,window._hxDiff]);});
t('the word-list coder does not code a differential line',()=>{
 const p=noteProblems('Primary Diagnosis: Unstable angina\nDifferential Diagnosis: Pulmonary embolism; Pneumothorax').map(x=>x.code);
 return p.some(c=>/^I20/.test(c))&&!p.some(c=>/^I26|^J93/.test(c))||p.join(',');});
t('the payer checks never read the criteria summary back as evidence',()=>{reset();
 fill('hx-out','PLAN: MRI\n\nMEDICAL NECESSITY:\n  - MRI lumbar spine: conservative therapy six weeks failed; plain x-ray done\n\nMedical Necessity:\n  - MRI: red flags');
 const a=_hxAllText();return !/conservative|plain x-ray|red flags/i.test(a)&&/PLAN: MRI/.test(a)||a;});
t('"no red flags" is evidence for the payer and the step',()=>{reset();
 fill('hx-red-none-v','1');return /red flags screened, none present/.test(_hxAllText())||'not in the evidence text';});

/* ---------- pregnancy ---------- */
t('pregnancy is asked of a woman 12 to 50, and only her',()=>{
 const c=[[{sex:'Female',years:30},true],[{sex:'Female',years:11},false],[{sex:'Female',years:51},false],[{sex:'Male',years:30},false],[{years:30},false]];
 const bad=c.filter(x=>{window._hxWho=x[0];return hxPregApplies()!==x[1];}).map(x=>JSON.stringify(x[0]));
 return !bad.length||bad.join(' | ');});
t('pregnancy status prints only when it applies and was answered',()=>{reset();
 window._hxWho={sex:'Female',years:30,age:30,unit:'y'};fill('hx-preg','Not pregnant');fill('hx-preg-lmp','2026-11-02');
 const a=hxPregData();window._hxWho={sex:'Male',years:30,age:30,unit:'y'};const b=hxPregData();
 const m=base();m.preg=a;const S_=section(hxSoapText(m),'SUBJECTIVE');
 return a&&a.status==='Not pregnant'&&b===null&&/Pregnancy Status: Not pregnant; LMP 2026-11-02/.test(S_)||JSON.stringify([a,b,S_]);});

/* ---------- formulary panel ---------- */
t('a medicine is checked once against the visit diagnosis',()=>{reset();
 fill('hx-plan-rx','Aspirin 300 mg stat');window._hxDx=[{code:'I20.0',desc:'Unstable angina'}];
 const d=hxChiData();const r=d.rows.filter(x=>/aspirin/i.test(x.label));
 return r.length===1&&r[0].hits.indexOf('I20.0')>=0||JSON.stringify(d.rows);});
t('a medicine with no matching indication says so',()=>{reset();
 fill('hx-plan-rx','Amoxicillin 500 mg');window._hxDx=[{code:'I10',desc:'Essential (primary) hypertension'}];
 const d=hxChiData();const r=d.rows[0];return r&&!r.hits.length&&r.ind.length>0||JSON.stringify(d.rows);});
t('with no match, the nearest listed indication is shown',()=>{reset();
 fill('hx-plan-rx','Naproxen 500 mg twice daily');window._hxDx=[{code:'M54.16',desc:'Radiculopathy, lumbar region'}];
 const r=hxChiData().rows[0];return r&&!r.hits.length&&/Low back pain \(M54\.5\)/.test(r.near[0]||'')||JSON.stringify(r);});
t('a GLP-1 agonist needs a request, and so does a long supply',()=>{reset();
 global.localStorage.setItem('rxdx_payer','taw');
 fill('hx-plan-rx','Semaglutide 0.25 mg weekly for 3 months');window._hxDx=[{code:'E11.9',desc:'Type 2 diabetes'}];
 const d=hxChiData();const r=d.rows.filter(x=>/semaglutide/i.test(x.label))[0];
 return r&&r.pa.some(s=>/GLP-1/i.test(s))&&/more than one month/i.test(d.long)||JSON.stringify(d);});
t('no treatment, no panel',()=>{reset();return hxChiData()===null||'panel without a treatment';});

/* ---------- completeness and settings ---------- */
t('the new fields count in completeness',()=>{reset();
 const p=PRESENTATIONS['Chest pain'];const a=hxScoreExtra(p);
 fill('hx-gen','In pain');fill('hx-results','ECG normal');fill('hx-impression','Angina.');const b=hxScoreExtra(p);
 return b.sum-a.sum===6&&a.max===b.max||JSON.stringify([a.sum,a.max,b.sum,b.max]);});
t('the organisation can make the new fields required',()=>{
 const ids=CFG_FIELDS.map(f=>f.id);const want=['hx-red-state','hx-preg','hx-preg-lmp','hx-gen','hx-results','hx-impression'];
 const miss=want.filter(w=>ids.indexOf(w)<0);return !miss.length||miss.join(',');});

/* ---------- emergency ---------- */
t('the emergency record has the same two layouts',()=>{reset();
 fill('ed-cc','Abdominal pain');fill('ed-hpc','Right iliac fossa pain since last night');fill('ed-allergy','NKDA');fill('ed-drugs','Paracetamol 1 g IV');
 fill('ed-reassess','Pain 3/10 after analgesia');window._edDx=[{code:'K35.8',desc:'Acute appendicitis'}];
 const x=edSoapText('interim','');
 return /^EMERGENCY DEPARTMENT — INTERIM ASSESSMENT NOTE/.test(x)&&/SUBJECTIVE\nChief Complaint: Abdominal pain/.test(x)
  &&/History of Present Illness: Right iliac fossa pain since last night\./.test(x)&&/OBJECTIVE\n[\s\S]*Re-assessment: Pain 3\/10 after analgesia/.test(x)
  &&/ASSESSMENT\nPrimary Diagnosis: Acute appendicitis/.test(x)&&/PLAN\nMedications Given: Paracetamol 1 g IV/.test(x)||x;});
t('an empty emergency field leaves no label',()=>{reset();fill('ed-cc','Headache');const x=edSoapText('final','');
 return !/:\s*$/m.test(x)&&!/undefined|null/.test(x)||x;});

done();
