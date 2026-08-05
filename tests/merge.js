/* Pre-authorisation merged into the History Builder.
   The claim under test: the payer's questions are asked inside the doctor's own
   flow, answering one clears it everywhere, and nothing is asked twice. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{PA,mdsRelevant,mdsPendingMatches,hxMdsRender,hxMdsData,'+
 'hxMdsCheck,hxMdsNoteLines,paMatch,paPayer,paAnswered,paQApplies,paNoteWarn,hxDxAdd,hxSex,hxWho,'+
 'whoYears,whoSex,hxClear,_mdsQid,hxMdsChips,_MDS_SP,paPayerName,hxRender,hxGenerate});');
const {t,done}=runner();

function setPayer(p){try{global.localStorage.setItem('rxdx_payer',p);}catch(_){}}
function fill(id,v){const e=S(id);e.value=v;return e;}
function mdsIds(){ return mdsRelevant().reduce((a,x)=>a.concat(x.items.map(i=>i.id)),[]); }
/* answer every field the step is showing, the way a doctor would */
function answerAll(txt){
 mdsRelevant().forEach(x=>x.items.forEach(i=>{
  const e=S('hx-md-'+i.id); e.value=txt||'documented'; e.setAttribute('data-ev',i.ev||'');
 }));
 hxMdsCheck();
}

/* ── one engine, not two ── */
t('the step is built from the payer bank, not the retired rule set',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const names=mdsRelevant().map(x=>x.rule.name);
 const inBank=names.every(n=>PA.req.some(r=>r.t===n)||n==='Antenatal care');
 return names.length>0&&inBank||('got '+JSON.stringify(names));});

t('the questions shown are the payer\'s own words',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const rel=mdsRelevant().filter(x=>!x.anc);
 if(!rel.length)return 'nothing matched';
 const set=PA.req.find(r=>r.t===rel[0].rule.name);
 return rel[0].items.every(i=>set.q.some(q=>q.q===i.l))||'a label was invented';});

t('every question keeps the evidence pattern it answers',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 return mdsRelevant().filter(x=>!x.anc).every(x=>x.items.every(i=>typeof i.ev==='string'&&i.ev.length))
  ||'an item lost its evidence pattern';});

/* ── nothing is asked twice ── */
t('a shared question is asked once and credited to both conditions',()=>{reset();setPayer('taw');
 fill('hx-input','Diabetes');hxDxAdd('E11.9');fill('hx-plan-rx','semaglutide 0.5 mg weekly, glucometer strips');
 const rel=mdsRelevant();
 const evs=rel.reduce((a,x)=>a.concat(x.items.map(i=>i.ev)),[]);
 const dup=evs.filter((e,i)=>evs.indexOf(e)!==i);
 return dup.length===0||('asked twice: '+dup.join(' | '));});

t('the shared answer names the other conditions it covers',()=>{reset();setPayer('taw');
 fill('hx-input','Diabetes');hxDxAdd('E11.9');fill('hx-plan-rx','semaglutide, glucometer, tirzepatide');
 const shared=mdsRelevant().reduce((a,x)=>a.concat(x.items),[]).filter(i=>i.also&&i.also.length);
 return shared.length>0||'the HbA1c question should have been credited to more than one set';});

t('no question id collides with another',()=>{reset();setPayer('all');
 fill('hx-input','Diabetes');hxDxAdd('E11.9');fill('hx-plan-rx','semaglutide glucometer insulin pump');
 const ids=mdsIds();return new Set(ids).size===ids.length||'duplicate field id';});

t('an id is stable across re-renders',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const a=mdsIds().join(),b=mdsIds().join();return a===b||'ids moved between renders';});

/* ── answering here answers everywhere ── */
t('answering the step clears the pre-authorisation warning',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const before=paNoteWarn('hx');
 if(!before)return 'nothing was outstanding to begin with';
 answerAll('non-cardiogenic, HEART score 2, serial ECG normal, troponin 0.01, CXR clear');
 return !paNoteWarn('hx')||('still outstanding: '+before.slice(0,80));});

t('an answer whose wording misses the pattern still counts as answered',()=>{reset();setPayer('taw');
 fill('hx-input','Chronic kidney disease');hxDxAdd('N18.3');fill('hx-plan-ix','renal ultrasound');
 const rel=mdsRelevant().filter(x=>!x.anc);
 if(!rel.length)return 'nothing matched';
 const it=rel[0].items.find(i=>/GFR/.test(i.ev||''));
 if(!it)return 'skip — GFR not in this set';
 const e=S('hx-md-'+it.id);e.value='62';e.setAttribute('data-ev',it.ev);hxMdsCheck();
 return paAnswered({ev:it.ev},'')||'a numeric answer was not counted';});

t('an empty field is never counted as answered',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 mdsRelevant().forEach(x=>x.items.forEach(i=>{const e=S('hx-md-'+i.id);e.value='';e.setAttribute('data-ev',i.ev||'');}));
 hxMdsCheck();
 return !!paNoteWarn('hx')||'blank fields silenced the payer warning';});

t('clearing the encounter clears the answered flags',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');answerAll();
 hxClear();
 return !global.window._paFilled||'stale answers survived a new patient';});

/* ── the answers reach the note ── */
t('an answer is written into the note under its condition',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const rel=mdsRelevant().filter(x=>!x.anc);if(!rel.length)return 'nothing matched';
 const it=rel[0].items[0];S('hx-md-'+it.id).value='HEART score 2';
 const L=hxMdsNoteLines().join('\n');
 return /HEART score 2/.test(L)&&L.indexOf(rel[0].rule.name)>=0||('note lines: '+L.slice(0,120));});

t('the note line credits a shared answer to every condition it covers',()=>{reset();setPayer('taw');
 fill('hx-input','Diabetes');hxDxAdd('E11.9');fill('hx-plan-rx','semaglutide, glucometer');
 const shared=mdsRelevant().reduce((a,x)=>a.concat(x.items),[]).find(i=>i.also&&i.also.length);
 if(!shared)return 'skip — nothing shared here';
 S('hx-md-'+shared.id).value='7.9%';
 const L=hxMdsNoteLines().join('\n');
 return /also for:/.test(L)||('no credit line: '+L.slice(0,160));});

t('the note carries no line for a question left blank',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 return hxMdsNoteLines().length===0||'a blank field wrote a line into the note';});

/* ── it stays quiet when it should ── */
t('nothing is asked when nothing is being requested',()=>{reset();setPayer('taw');
 fill('hx-input','Sore throat');
 return mdsRelevant().length===0||('asked anyway: '+mdsRelevant().map(x=>x.rule.name));});

t('a service-gated set stays quiet until that service is planned',()=>{reset();setPayer('taw');
 fill('hx-input','Osteoarthritis');hxDxAdd('M17.0');
 const quiet=mdsRelevant().length;
 fill('hx-plan-rx','for total knee arthroplasty');
 const loud=mdsRelevant().length;
 return loud>quiet||('quiet '+quiet+' → planned '+loud);});

t('the pending note names the service that would trigger it',()=>{reset();setPayer('taw');
 fill('hx-input','Osteoarthritis');hxDxAdd('M17.0');
 const p=mdsPendingMatches();
 return p.length>0&&p.every(x=>x.name)||'no pending set was offered';});

t('a set the patient cannot have is never asked',()=>{reset();setPayer('all');
 hxSex('Male');fill('hx-age','40');hxWho();
 fill('hx-input','pregnancy');
 return mdsRelevant().every(x=>!/antenatal|pregnan|obstetric/i.test(x.rule.name))
  ||'an obstetric set was asked of a male patient';});

t('a switched-off set disappears from the step',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const before=mdsRelevant().map(x=>x.rule.name);
 if(!before.length)return 'nothing to switch off';
 const o=JSON.parse(global.localStorage.getItem('rxdx_itc_v1')||'{}');
 o.off=o.off||{};o.off.mds=[before[0]];global.localStorage.setItem('rxdx_itc_v1',JSON.stringify(o));
 const after=mdsRelevant().map(x=>x.rule.name);
 o.off.mds=[];global.localStorage.setItem('rxdx_itc_v1',JSON.stringify(o));
 return after.indexOf(before[0])<0||('still shown: '+before[0]);});

/* ── the clinic picker follows the same bank ── */
t('the clinic picker lists conditions from the bank',()=>{reset();setPayer('taw');
 S('hx-clinic').value='Cardiology';hxMdsChips();
 const h=S('hx-mds-chips').innerHTML;
 const card=PA.req.filter(r=>r.sp==='Cardiology'&&r.pay.indexOf('taw')>=0);
 return card.some(r=>h.indexOf(r.t)>=0)||('chips: '+h.slice(0,140));});

t('every clinic in the picker maps to a real specialty',()=>{
 const known=new Set(PA.req.map(r=>r.sp));
 const bad=[];Object.keys(_MDS_SP).forEach(c=>_MDS_SP[c].forEach(s=>{if(!known.has(s))bad.push(c+'→'+s);}));
 return bad.length===0||('unmapped: '+bad.join());});

/* ── the counter tells the truth ── */
t('the readiness counter matches the questions on screen',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const shown=mdsRelevant().reduce((n,x)=>n+(x.anc?2:x.items.length),0);
 return hxMdsData().total===shown||(hxMdsData().total+' counted vs '+shown+' shown');});

t('answering moves the counter',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const b=hxMdsData().filled;answerAll();const a2=hxMdsData().filled;
 return a2>b||('filled '+b+' → '+a2);});

t('a full answer set reports sufficient',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');answerAll();
 const d=hxMdsData();
 return d.total>0&&d.missing.length===0||('missing '+d.missing.length+' of '+d.total);});

/* ── it renders ── */
t('the step renders a real input for every question',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');hxMdsRender();
 const h=S('hx-mds').innerHTML,n=(h.match(/id="hx-md-/g)||[]).length;
 const want=mdsRelevant().filter(x=>!x.anc).reduce((s,x)=>s+x.items.length,0);
 return n===want||(n+' inputs for '+want+' questions');});

t('each rendered input carries the pattern it satisfies',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');hxMdsRender();
 const h=S('hx-mds').innerHTML;
 return (h.match(/data-ev="/g)||[]).length>0||'no evidence binding in the markup';});

t('the header names the payer doing the asking',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');hxMdsRender();
 return S('hx-mds').innerHTML.indexOf(paPayerName('taw'))>=0||'the payer is not named';});

t('nothing in the step claims to block the doctor',()=>{reset();setPayer('taw');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');hxMdsRender();
 const h=S('hx-mds').innerHTML;
 return !/cannot (finalise|proceed|continue)|must be completed before/i.test(h)||'the step claims to block';});

t('the whole builder still renders with the merge in place',()=>{reset();setPayer('all');
 fill('hx-input','Diabetes');hxDxAdd('E11.9');
 try{hxRender();}catch(e){return 'hxRender threw: '+e.message;}
 return !!S('hx-mds');});

t('the encounter ledger records the sets that were actually asked',()=>{reset();setPayer('taw');
 global.localStorage.removeItem('rxdx_preauth_v1');
 fill('hx-input','Chest pain');hxDxAdd('I20.0');
 const asked=mdsRelevant().map(x=>x.rule.name);
 try{hxGenerate();}catch(e){return 'hxGenerate threw: '+e.message;}
 const led=JSON.parse(global.localStorage.getItem('rxdx_preauth_v1')||'{}');
 return asked.every(n=>led[n])||('asked '+JSON.stringify(asked)+' · ledger '+JSON.stringify(Object.keys(led)));});

t('the pane and the step never give two different counts',()=>{
 const cases=[['taw','Diabetes','E11.9','semaglutide, glucometer, insulin pump'],
  ['all','Diabetes','E11.9','semaglutide, glucometer'],
  ['taw','Chest pain','I20.0',''],
  ['taw','Osteoarthritis','M17.0','total knee arthroplasty'],
  ['bupa','Heart failure','I50.0','admission'],
  ['art','Cataract','H25.9','phacoemulsification']];
 const bad=[];
 cases.forEach(c=>{reset();setPayer(c[0]);
  fill('hx-input',c[1]);hxDxAdd(c[2]);if(c[3])fill('hx-plan-rx',c[3]);
  const fields=mdsRelevant().reduce((n,x)=>n+x.items.length,0);
  const m=/ask for (\d+) thing/.exec(paNoteWarn('hx')||'');
  const pane=m?+m[1]:0;
  if(pane!==fields)bad.push(c[0]+'/'+c[1]+': pane '+pane+' vs step '+fields);});
 return bad.length===0||bad.join(' | ');});

t('a shared item is credited in the pane too',()=>{reset();setPayer('taw');
 fill('hx-input','Diabetes');hxDxAdd('E11.9');fill('hx-plan-rx','semaglutide, glucometer');
 const w=paNoteWarn('hx')||'';
 return /also covers/.test(w)||'the pane lists a shared item without saying so';});

done();
