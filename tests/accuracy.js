/* Accuracy floor. These numbers were measured on 30 hand-labelled notes on the
   day the corpus was written. They may go up. If a change sends them down, the
   change is wrong, whatever else it improved. */
const {load,makeEnv,runner}=require('./_harness.js');
const fs=require('fs');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{_stProblems,_stMeds,_buildNoteIndexes,ICD_MAP,SYN,_stRank,_stImpression,_stIsSymptom});');
const {t,done}=runner();
const corpus=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','gold','corpus.json'),'utf8'));
const idx=_buildNoteIndexes();
const termToCode={};idx.probTerms.forEach(x=>{termToCode[x.term.toLowerCase()]=x.code;});
function run(note){const low=' '+note.toLowerCase().replace(/\s+/g,' ')+' ';return _stProblems(note,low);}
function score(){
 let TP=0,FP=0,FN=0,negT=0,negP=0,dT=0,dF=0;
 corpus.forEach(n=>{
  const all=run(n.note), pred=all.filter(x=>x.principal!==false).map(x=>x.code);
  const g=new Set(n.codes),p=new Set(pred);
  n.codes.forEach(c=>p.has(c)?TP++:FN++);
  pred.forEach(c=>{if(!g.has(c))FP++;});
  (n.must_not_code||[]).forEach(term=>{
   const tl=term.toLowerCase();let c=termToCode[tl];
   if(!c)for(const k in termToCode){if(k===tl||k.includes(tl)||tl.includes(k)){c=termToCode[k];break;}}
   if(!c)return; negT++; if(!new Set(all.map(x=>x.code)).has(c))negP++;});
  const meds=_stMeds(n.note,' '+n.note.toLowerCase()+' ').join(' ').toLowerCase();
  (n.drugs||[]).forEach(d=>{meds.includes(d.toLowerCase().split(' ')[0])?dT++:dF++;});
 });
 const P=TP/(TP+FP||1),R=TP/(TP+FN||1);
 return {P,R,F1:(P+R)?2*P*R/(P+R):0,neg:negP/(negT||1),drug:dT/((dT+dF)||1),negT};
}
const s=score();
const pct=x=>(x*100).toFixed(1)+'%';

t('precision on the principal diagnosis is at least 60%',()=>s.P>=0.60||('got '+pct(s.P)));
t('recall on the principal diagnosis is at least 75%',()=>s.R>=0.75||('got '+pct(s.R)));
t('F1 is at least 68%',()=>s.F1>=0.68||('got '+pct(s.F1)));
t('a denied finding is never coded — 100%, no exceptions',()=>s.neg===1||('got '+pct(s.neg)));
t('the negation test is not vacuous',()=>s.negT>=50||('only '+s.negT+' real traps'));
t('every drug in the corpus is found',()=>s.drug===1||('got '+pct(s.drug)));

/* the specific defects the corpus exposed — each must stay fixed */
const none=n=>run(n).length===0;
t('"Plan: add empagliflozin" does not code ADHD',()=>none('Plan: add empagliflozin.'));
t('"arterial blood gas" does not code flatulence',()=>none('Arterial blood gas shows pH 7.31.'));
t('"cold and clammy" does not code the common cold',()=>none('Peripheries cold and clammy.'));
t('"the mask fits well" does not code a seizure',()=>none('The nasal mask fits well.'));
t('"he began to sob" does not code dyspnoea',()=>none('He began to sob quietly.'));
t('but ADD in capitals still codes ADHD',()=>run('Known ADD on methylphenidate.').some(x=>x.code==='F90.0'));
t('and SOB in capitals still codes dyspnoea',()=>run('SOB on exertion.').some(x=>x.code==='R06.0'));
t('lower-case htn and copd still code',()=>{const r=run('Known htn and copd.').map(x=>x.code);
 return (r.includes('I10')&&r.includes('J44.9'))||r.join();});

/* principal vs supporting */
t('a symptom is demoted when the note names a diagnosis',()=>{
 const r=run('Cough and fever 4 days.\nImpression: community acquired pneumonia.');
 const pri=r.filter(x=>x.principal!==false).map(x=>x.code);
 return (pri.includes('J18.9')&&!pri.includes('R05')&&!pri.includes('R50.9'))||pri.join();});
t('a symptom stays principal when there is no diagnosis',()=>{
 const r=run('Cough and fever for 4 days. No focus found.');
 return r.every(x=>x.principal!==false)||'a symptom was demoted with nothing to demote it to';});
t('the code the doctor named ranks first',()=>{
 const r=run('Chest pain and nausea.\nImpression: unstable angina.');
 return (r[0]&&r[0].named===true)||JSON.stringify(r.slice(0,2));});
t('the impression is read, the plan is not',()=>{
 const imp=_stImpression('History: cough.\nImpression: pneumonia.\nPlan: consider asthma review.');
 return (/pneumonia/i.test(imp)&&!/asthma/i.test(imp))||JSON.stringify(imp);});
t('the classification decides what cannot be principal',()=>_stIsSymptom('R50.9')===true&&_stIsSymptom('J18.9')===false);

/* the vocabulary must not shrink */
t('the vocabulary covers at least 470 codes',()=>Object.keys(SYN).length>=470||('only '+Object.keys(SYN).length));
t('every vocabulary code exists in the ICD table',()=>{
 const bad=Object.keys(SYN).filter(c=>!ICD_MAP[c]);
 return bad.length===0||('not in the table: '+bad.slice(0,6).join());});

console.log();
console.log('  measured now:  precision '+pct(s.P)+' · recall '+pct(s.R)+' · F1 '+pct(s.F1)
 +' · negation '+pct(s.neg)+' ('+s.negT+' real traps) · drugs '+pct(s.drug));
done();
