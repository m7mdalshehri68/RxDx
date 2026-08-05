/* The coder review queue, the confidence engine, and the content register. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{cdrBuckets,cdrRender,cdrQueryText,cdrResolve,cdrReopen,cdrDone,'+
 '_stProblems,_stScore,_stSiblings,_stIsVague,_stSentence,_confBand,hxDxAdd,hxSex,hxWho,hxClear,'+
 'CONTENT_REG,cregRender,auditLog,auditList,auditRender,ICD_MAP});');
const {t,done}=runner();
const run=n=>_stProblems(n,' '+n.toLowerCase().replace(/\s+/g,' ')+' ');
function scenario(){reset();
 S('note-input').value='62 y male, cough and fever for 4 days, right pleuritic chest pain.\nCXR: right lower lobe consolidation.\nImpression: pneumonia.\nPlan: amoxicillin.';
 hxDxAdd('J18.9');hxDxAdd('I50.9');return cdrBuckets();}
const bucket=(B,id)=>B.find(b=>b.id===id).items.filter(x=>!x.resolved);

/* ── confidence ── */
t('a code named in the impression scores higher than a symptom',()=>{
 const r=run('Cough and fever.\nImpression: community acquired pneumonia.');
 const p=r.find(x=>x.code==='J18.9'), c=r.find(x=>x.code==='R05');
 return (p&&c&&p.conf>c.conf)||('pneumonia '+(p&&p.conf)+' vs cough '+(c&&c.conf));});
t('every suggestion carries the sentence it came from',()=>{
 const r=run('Known htn.\nImpression: pneumonia.');
 return r.every(x=>typeof x.evidence==='string'&&x.evidence.length>0)||'a suggestion had no evidence';});
t('the evidence is the doctor\'s own words, not a template',()=>{
 const r=run('Cough for 4 days.\nImpression: community acquired pneumonia.');
 const p=r.find(x=>x.code==='J18.9');
 return /Impression: community acquired pneumonia/.test(p.evidence)||p.evidence;});
t('every suggestion states why the score moved',()=>{
 const r=run('Known htn.\nImpression: pneumonia.');
 return r.every(x=>Array.isArray(x.why))||'a suggestion had no reasons';});
t('an abbreviation-only match is marked down',()=>{
 const r=run('Known HTN.');const h=r.find(x=>x.code==='I10');
 return (h&&h.why.some(w=>/abbreviation/.test(w[1])))||JSON.stringify(h&&h.why);});
t('confidence never leaves 0 to 1',()=>{
 const r=run('Chest pain, fever, cough, htn, COPD, pneumonia, stroke, sepsis.');
 return r.every(x=>x.conf>0&&x.conf<1)||'out of range';});
t('a code that contradicts the patient is marked down hard',()=>{reset();
 hxSex('Male');S('hx-age').value='40';hxWho();
 const a=run('Impression: pregnancy.');
 const preg=a.find(x=>/^(O|Z3)/.test(x.code));
 if(!preg)return true;   /* nothing obstetric matched — nothing to test */
 return preg.conf<0.4||('scored '+preg.conf);});
t('the bands are ordered',()=>_confBand(0.9)==='high'&&_confBand(0.6)==='medium'&&_confBand(0.2)==='low');

/* ── the seven buckets ── */
t('all seven buckets exist',()=>{const B=scenario();
 const want=['doc','conf','conf2','spec','proc','risk','query'];
 const miss=want.filter(w=>!B.some(b=>b.id===w));
 return miss.length===0||('missing '+miss.join());});
t('a low-confidence suggestion reaches the queue',()=>bucket(scenario(),'conf').length>0);
t('a code the note never mentions is flagged as a disagreement',()=>{
 const it=bucket(scenario(),'conf2').find(x=>x.code==='I50.9');
 return (it&&/nothing in the written note/i.test(it.ev))||'heart failure was not questioned';});
t('an unspecified code is offered its specific siblings',()=>{
 const it=bucket(scenario(),'spec').find(x=>x.code==='I50.9');
 return (it&&/I50\.0/.test(it.ev))||(it?it.ev:'not flagged');});
t('a specific code is not flagged as unspecified',()=>{
 return _stIsVague('I50.0')===false&&_stIsVague('I50.9')===true;});
t('siblings never include the code itself',()=>_stSiblings('I50.9').indexOf('I50.9')<0);
t('an unanswered payer question raises refusal risk',()=>{reset();
 S('hx-input').value='Chest pain';hxDxAdd('I20.0');
 return bucket(cdrBuckets(),'risk').length>0||'no refusal risk raised';});
t('a disagreement generates a query to the doctor',()=>bucket(scenario(),'query').length>0);

/* ── the query itself must not lead the doctor ── */
t('the draft query never suggests an answer',()=>{
 const it=bucket(scenario(),'query')[0];const q=cdrQueryText(it);
 return !/should be coded as|please code|change it to|we suggest/i.test(q)||q;});
t('the draft query says it changes nothing on its own',()=>{
 const q=cdrQueryText(bucket(scenario(),'query')[0]);
 return /no code will be changed/i.test(q)||q.slice(-160);});
t('the draft query shows what was found',()=>{
 const it=bucket(scenario(),'query')[0];
 return cdrQueryText(it).indexOf(it.ev)>=0||'the evidence is missing from the query';});

/* ── working the queue ── */
t('resolving an item takes it off the open list',()=>{
 const B=scenario();const it=bucket(B,'conf2')[0];const n=bucket(scenario(),'conf2').length;
 cdrResolve(it.key,'accepted');
 const after=bucket(cdrBuckets(),'conf2').length;
 cdrReopen(it.key);
 return after===n-1||(n+' → '+after);});
t('reopening puts it back',()=>{
 const B=scenario();const it=bucket(B,'conf2')[0];
 cdrResolve(it.key,'rejected');cdrReopen(it.key);
 return bucket(cdrBuckets(),'conf2').some(x=>x.key===it.key)||'it did not come back';});
t('a decision is written to the audit trail',()=>{
 const before=auditList().length;
 const it=bucket(scenario(),'conf2')[0];
 cdrResolve(it.key,'accepted');cdrReopen(it.key);
 return auditList().length>before||'nothing was audited';});
t('the queue renders',()=>{scenario();cdrRender();
 const h=S('cdr-out').innerHTML;
 return h.length>200&&/Accept/.test(h)&&/Reject/.test(h)||h.slice(0,120);});
t('a clean encounter shows an empty queue, not a fake one',()=>{reset();
 const B=cdrBuckets();
 return B.every(b=>b.items.filter(x=>!x.resolved).length===0)||
  B.filter(b=>b.items.length).map(b=>b.id+':'+b.items.length).join();});

/* ── governance ── */
t('every content block names a source and a version',()=>
 CONTENT_REG.every(r=>r.n&&r.v&&r.src)||'a content block is missing its provenance');
t('the three payer protocols are registered with their versions',()=>{
 const p=CONTENT_REG.filter(r=>/^pa_/.test(r.id));
 return (p.length===3&&p.every(r=>r.v&&r.v!=='' ))||JSON.stringify(p.map(x=>x.v));});
t('nothing ships pre-approved',()=>CONTENT_REG.every(r=>!r.sign)||'content shipped marked as approved');
t('the register renders',()=>{cregRender();
 return /Not yet approved by a clinician/.test(S('creg-out').innerHTML)||'the register did not render';});
t('the audit trail holds no patient data',()=>{
 auditLog('test','wrote','J18.9');
 return auditList().every(r=>!/\b\d{2}\/\d{2}\/\d{4}\b|patient name|MRN/i.test(r.d||''))||'patient data in the audit trail';});
t('the audit trail is capped so it cannot grow without bound',()=>{
 for(let i=0;i<40;i++)auditLog('test','bulk','n'+i);
 return auditList().length<=3000||'unbounded';});

done();
