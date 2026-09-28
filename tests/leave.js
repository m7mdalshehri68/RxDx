/* "Before the patient leaves", inside the History Builder.
   The claim under test: it reads what the builder already holds, lists the same
   questions step 7 asks, credits an answer wherever it was written, and never
   blocks the doctor. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code,html}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{hxLeaveData,hxLeaveRender,hxLeaveGo,_hxLeaveChip,hxStepsRender,'+
 'mdsRelevant,hxMdsData,hxMdsCheck,hxMdsRender,hxDxAdd,hxWho,hxSex,paSetPayer,paPayer,paPayerName,'+
 'PA,RX_NAV,RX_LABELS,rxEncounter,hxClear,window});');
const {t,done}=runner();

const setPayer=p=>global.localStorage.setItem('rxdx_payer',p);
const fill=(id,v)=>{const e=S(id);e.value=v;return e;};
const visit=(p)=>{reset();setPayer(p||'taw');fill('hx-input','Chest pain');hxDxAdd('I20.0');};

/* ── where it lives ── */
t('the separate screen is gone from the doctor navigation',()=>
 !RX_NAV.doctor.some(g=>g[1].indexOf('visit')>=0)||'visit is still in the navigation');
t('the History Builder carries it, just before step 9',()=>{
 const i=html.indexOf('id="hx-leave-sec"'),j=html.indexOf('<span class="hx-stepn">9</span>');
 return (i>0&&j>0&&i<j)||('section at '+i+', step 9 at '+j);});
t('the engine the API answers with is still there',()=>typeof rxEncounter==='function');

/* ── what it lists ── */
t('with no complaint it asks for one',()=>{reset();setPayer('taw');hxLeaveRender();
 return /presenting complaint first/.test(S('hx-leave').innerHTML)||S('hx-leave').innerHTML.slice(0,120);});
t('a chest pain visit lists what the payer will ask',()=>{visit();
 const d=hxLeaveData();
 return d.sets.length>0&&d.missing.length>0||JSON.stringify({sets:d.sets.length,missing:d.missing.length});});
t('the requirement sets are the ones step 7 shows',()=>{visit();
 const a=hxLeaveData().sets.join('|'),b=mdsRelevant().map(x=>x.anc?'Antenatal care':x.rule.name).join('|');
 return a===b||(a+' vs '+b);});
t('step 7 and the checklist never disagree on what is missing',()=>{visit();
 const a=hxLeaveData().missing.length,b=hxMdsData().missing.length;
 return a===b||(a+' in the checklist, '+b+' in step 7');});
t('every missing item is the payer\'s own question',()=>{visit();
 const all=new Set(PA.req.flatMap(r=>r.q.map(q=>q.q)));
 const bad=hxLeaveData().missing.filter(m=>!all.has(m.ask));
 return bad.length===0||('not in the bank: '+bad[0].ask);});
t('optional items are never listed as missing',()=>{
 for(const p of ['bupa','taw','art','all']){visit(p);
  const opt=new Set(PA.req.flatMap(r=>r.q.filter(q=>q.opt).map(q=>q.q)));
  const req=new Set(PA.req.flatMap(r=>r.q.filter(q=>!q.opt).map(q=>q.q)));
  const bad=hxLeaveData().missing.filter(m=>opt.has(m.ask)&&!req.has(m.ask));
  if(bad.length)return p+': '+bad[0].ask;}
 return true;});

/* ── an answer counts wherever it was written ── */
t('answering in step 7 clears the item',()=>{visit();
 const m=hxLeaveData().missing[0]; fill(m.id,'documented'); hxMdsCheck();
 return !hxLeaveData().missing.some(x=>x.id===m.id)||'still listed after answering';});
t('writing it anywhere else in the encounter clears it too',()=>{visit();
 const before=hxLeaveData().missing.length;
 fill('hx-plan-ix','ECG: ST depression V4-V6. Troponin T 45 ng/L. HEART score 6.');
 const after=hxLeaveData().missing.length;
 return after<before||('still '+after+' of '+before);});
t('the item it credits moves to already satisfied',()=>{visit();
 fill('hx-plan-ix','HEART score 6.');
 const d=hxLeaveData();
 return d.done.some(x=>/HEART score/i.test(x.ask))&&!d.missing.some(x=>/HEART score/i.test(x.ask))||'not moved';});
t('step 7 credits the same answer, so the two stay in step',()=>{visit();
 fill('hx-plan-ix','HEART score 6.');
 return hxLeaveData().missing.length===hxMdsData().missing.length||'they disagree once the plan answers';});

/* ── the patient in front of the doctor ── */
t('a condition in the background goes to the coder, not this visit',()=>{visit();
 fill('hx-pmh','Known type 2 diabetes mellitus on metformin, hypertension on amlodipine');
 const d=hxLeaveData();
 return d.other.length>0&&d.other.every(x=>d.sets.indexOf(x)<0)||JSON.stringify(d.other);});
t('a drug or device nobody is requesting is not listed as a condition',()=>{visit();
 fill('hx-pmh','Known type 2 diabetes mellitus on metformin, hypertension on amlodipine');
 const o=hxLeaveData().other.join(' | ');
 return !/mounjaro|GLP-1|glucometer|retinal|device/i.test(o)||o;});
t('a set for the other sex never appears',()=>{
 const f=PA.req.find(r=>r.sex&&r.sex.charAt(0)==='F'&&(r.px||[]).length&&!r.svc);
 if(!f)return 'no female-only set with codes to test';
 reset();setPayer('all');fill('hx-age','40');hxWho();hxSex('Male');fill('hx-input','Chest pain');hxDxAdd(f.px[0]);
 return hxLeaveData().sets.indexOf(f.t)<0||('shown to a man: '+f.t);});

/* ── the screen ── */
t('the status line counts what is shown',()=>{visit();hxLeaveRender();
 const d=hxLeaveData(),s=S('hx-leave-stat').textContent;
 return s.indexOf(d.missing.length+' still to write')===0||s;});
t('each missing item opens its own field',()=>{visit();hxLeaveRender();
 const m=hxLeaveData().missing[0];
 return S('hx-leave').innerHTML.indexOf("hxLeaveGo('"+m.id+"')")>=0||'no link to the field';});
t('opening an item turns step 7 to the payer questions',()=>{visit();hxMdsRender();
 hxLeaveGo(hxLeaveData().missing[0].id);
 return window._hxDocsTab==='mds'||('tab '+window._hxDocsTab);});
t('payer questions stay in English',()=>{visit();hxLeaveRender();
 return /class="hx-lv-q noi18n"/.test(S('hx-leave').innerHTML)||'not protected from translation';});
t('with one set the set name is not repeated on every line',()=>{visit();hxLeaveRender();
 return hxLeaveData().sets.length!==1||!/hx-lv-set/.test(S('hx-leave').innerHTML)||'set name repeated';});
t('with several sets each line names its set, in English',()=>{
 reset();setPayer('all');fill('hx-input','Chest pain');hxDxAdd('I20.0');hxDxAdd('E11.9');hxLeaveRender();
 const d=hxLeaveData();
 if(d.sets.length<2)return 'only '+d.sets.length+' set matched';
 return /class="hx-lv-set noi18n"/.test(S('hx-leave').innerHTML)||'set names missing';});
t('the step strip shows how many are left',()=>{visit();hxLeaveRender();
 const c=_hxLeaveChip(),n=hxLeaveData().missing.length;
 return c.indexOf('<i class="hxs-n">'+n+'</i>')>=0||c;});
t('the strip does not dress the count up as a step number',()=>{visit();hxLeaveRender();
 return !/<b>\d+<\/b>/.test(_hxLeaveChip())||'looks like a step number';});
t('it never blocks finalising',()=>{visit();hxLeaveRender();
 return !/disabled|preventDefault|return false/.test(S('hx-leave').innerHTML)||'something here blocks';});

/* ── one insurer switch for every place that shows it ── */
t('switching the insurer re-asks step 7 and the checklist',()=>{visit('taw');hxMdsRender();hxLeaveRender();
 paSetPayer('bupa');
 const a=S('hx-mds').innerHTML.indexOf('class="on" onclick="paSetPayer(\'bupa\')"')>=0;
 const b=S('hx-leave').innerHTML.indexOf('class="on" onclick="paSetPayer(\'bupa\')"')>=0;
 return a&&b||('step 7 '+a+', checklist '+b);});
t('a new patient clears it',()=>{visit();fill('hx-plan-ix','HEART score 6.');hxClear();hxLeaveRender();
 return /presenting complaint first/.test(S('hx-leave').innerHTML)||S('hx-leave').innerHTML.slice(0,100);});

done();
