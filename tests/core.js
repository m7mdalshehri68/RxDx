const H=require('./_harness.js');
const {html,code}=H.load(); const env=H.makeEnv(); const {S,sel,reset}=env;
const {t,done}=H.runner();
const NAMES=['ICD','IDF','ICD_MAP','_stProblems','_stSkipNote','rxNetCheck','rxNetPaint','PLANCX','PLAN_Q','CXPLUS','PROTO','NATLIB','protoForPlan',
  'protoGaps','protoRender','justGaps','justAudit','justRender','hxDxAdd','rxFullEncounter','hxGenerate',
  'hxRender','edOnComplaint','edWuQuick','edOnsetSync','edSiteInit','hxDur','hxDurSync','hxSelect',
  'HX_SITES','HX_REL','hxFamWho','hxFamSync','hxDetailBox','_hxHint','_hxAllText','schedSearch','uniSearch',
  'hxMdsData','mdsRelevant','mdsWrite','hxDocsRender','HX_DOCS','hxReferralText','hxPatientText','hxRequestText',
  'PRESENTATIONS','itcLoad','itcSave','encList','encPut','exStats','aiCfg','aiSet','aiReady'];
eval(code+'\n;NAMES.forEach(function(n){try{global[n]=eval(n);}catch(_){}});');
const codes=n=>_stProblems(n,' '+n.toLowerCase().replace(/\s+/g,' ')+' ').map(x=>x.code+' '+x.desc);
const has=(n,rx)=>codes(n).some(c=>rx.test(c));

/* ── data integrity ── */
t('code table loaded',()=>ICD.length>16000);
t('drug table loaded',()=>IDF.length>1000);
t('98 complaints',()=>Object.keys(PRESENTATIONS).length===98);
t('every complaint has a scoped plan',()=>Object.keys(PLANCX).length===98);
t('the broken auto-extraction is gone',()=>
 Object.keys(CXPLUS.ddx||{}).length===0&&Object.keys(CXPLUS.red||{}).length===0);
t('hand-written protocols present',()=>PROTO.length>=9&&PROTO.every(p=>p.when&&(p.write||[]).length));
t('the document library is indexed',()=>NATLIB.length>=160);
t('every protocol code prefix exists',()=>PROTO.every(p=>(p.px||[]).every(x=>
 Object.keys(ICD_MAP).some(c=>c.indexOf(x)===0))));

/* ── search ── */
t('drug search works',()=>{S('idf-input').value='metformin';schedSearch('idf');
 return /metformin/i.test(S('idf-out').innerHTML);});
t('code search works',()=>{S('icd-input').value='diabetes';schedSearch('icd');
 return /E1[0-4]/.test(S('icd-out').innerHTML);});

/* ── only active diagnoses are coded ── */
t('denied symptom is not coded',()=>!has('Patient denies fever. Cough 3 days.',/fever/i));
t('the real symptom is coded',()=>has('Patient denies fever. Cough 3 days.',/cough/i));
t('family history is not the patient',()=>!has('Family history of diabetes mellitus.',/diabetes/i));
t('ruled out is not coded',()=>!has('Pulmonary embolism ruled out.',/embolism/i));
t('the doctor is told what was left out',()=>{codes('Denies fever.');return /Not coded, and why/.test(_stSkipNote());});

/* ── the plan belongs to the complaint ── */
t('back pain gets no troponin',()=>!/troponin|chest x-ray/i.test(PLANCX['Back pain'].ix.join(' ')));
t('chest pain keeps its work-up',()=>/troponin/i.test(PLANCX['Chest pain'].ix.join(' ')));
t('no conditional option is offered',()=>{
 const C=/only if|if criteria|criteria met|unless|consider/i,bad=[];
 Object.keys(PLANCX).forEach(c=>['ix','rx','ref'].forEach(k=>
  (PLANCX[c][k]||[]).forEach(x=>{if(C.test(x))bad.push(c+'·'+x);})));
 return bad.length===0||bad.slice(0,3).join(' | ');});
t('tapping the offered options never triggers a complaint',()=>{reset();
 S('hx-input').value='Back pain';
 S('hx-plan-ix').value=PLANCX['Back pain'].ix.filter(x=>!/no investigation/i.test(x)).join(', ');
 return protoGaps('hx').length===0;});

/* ── structured fields ── */
t('site is a dropdown',()=>/optgroup/.test(hxSelect('hx-site','Site',HX_SITES,'x')));
t('duration is number + unit',()=>{reset();S('hx-duration-n').value='6';S('hx-duration-u').value='days';
 hxDurSync('hx-duration');return S('hx-duration').value==='6 days';});
t('family history names the relative',()=>{reset();
 sel['#hx-fam .hx-neg-on']=[{getAttribute:()=>'0'}];hxFamWho();
 S('hx-fam-r0').value='Father';S('hx-fam-a0').value='52';hxFamSync();
 return /Father/.test(S('hx-fhx').value)&&/52/.test(S('hx-fhx').value);});
t('an abnormal finding asks what',()=>{const r={_kids:[],_attr:{'data-t':'Range of movement'},
 getAttribute(n){return this._attr[n]||null;},setAttribute(n,v){this._attr[n]=v;},removeAttribute(n){delete this._attr[n];},
 querySelector(){return this._kids[0]||null;},appendChild(x){this._kids.push(x);}};
 hxDetailBox(r,'2');return r._kids.length===1;});
t('the hint fits the finding',()=>/degrees/.test(_hxHint('Range of movement')));

/* ── the encounter hangs together ── */
t('the summary shows the chosen codes',()=>{reset();
 S('hx-input').value='Chest pain';hxDxAdd('I20.0');rxFullEncounter();
 return /I20\.0/.test(S('hx-enc').innerHTML)&&/Impression/.test(S('hx-enc').innerHTML);});
t('every note document is reachable',()=>{
 const want=['note','just','pa','nat','clin','ref','pt','req'];
 const have=HX_DOCS.map(d=>d[0]);
 const miss=want.filter(k=>!have.includes(k));
 return miss.length===0||('missing '+miss.join());});
t('the referral letter carries the history',()=>{reset();
 S('hx-input').value='Chest pain';S('hx-plan-ref').value='Cardiology';
 S('hx-pmh').value='hypertension';return /hypertension/.test(hxReferralText());});

/* ── connection light: it must never claim green without proof ── */
t('a local file is never called online',()=>{global.location={protocol:'file:',reload(){},href:''};
 rxNetCheck();const e=S('rx-net');
 return /\bunk\b/.test(e.className)&&/Not verified/.test(e.innerHTML);});
t('a local file says the tool still works',()=>{global.location={protocol:'file:',reload(){},href:''};
 rxNetCheck();return /works either way/i.test(S('rx-net').title||'');});
t('no network means red, without probing',()=>{
 global.location={protocol:'https:',host:'h',pathname:'/a',reload(){},href:''};
 navigator.onLine=false;rxNetCheck();navigator.onLine=true;
 const e=S('rx-net');return /\boff\b/.test(e.className)&&/Offline/.test(e.innerHTML);});
/* a thenable that settles immediately, so the probe can be tested in one tick */
const now=ok=>({then(res){if(ok)res({ok:true});return this;},
 catch(rej){if(!ok)rej(new Error('no route'));return this;}});
t('a failed probe means red, not green',()=>{
 global.location={protocol:'https:',host:'h',pathname:'/a',reload(){},href:''};
 global.fetch=()=>now(false);rxNetPaint('unknown','');rxNetCheck();
 return /\boff\b/.test(S('rx-net').className);});
t('only a real reply turns it green',()=>{
 global.location={protocol:'https:',host:'h',pathname:'/a',reload(){},href:''};
 global.fetch=()=>now(true);rxNetPaint('unknown','');rxNetCheck();
 const e=S('rx-net');return /\bon\b/.test(e.className)&&/Online/.test(e.innerHTML);});
t('green still promises data stays here',()=>{
 global.location={protocol:'https:',host:'h',pathname:'/a',reload(){},href:''};
 global.fetch=()=>now(true);rxNetCheck();
 return /never leaves this device/i.test(S('rx-net').title||'');});
t('the probe gives up rather than hang',()=>{
 global.location={protocol:'https:',host:'h',pathname:'/a',reload(){},href:''};
 global.fetch=()=>({then(){return this;},catch(){return this;}});
 rxNetPaint('unknown','');rxNetCheck();global._fireTimers();
 return /\boff\b/.test(S('rx-net').className);});

/* ── emergency ── */
t('ED onset is number + unit',()=>{reset();S('ed-onset-t').value='Sudden';
 S('ed-onset-n').value='3';S('ed-onset-u').value='days';edOnsetSync();
 return S('ed-onset').value==='Sudden, for 3 days';});
t('ED work-up is scoped',()=>{reset();S('ed-cc').value='Back pain';edWuQuick();
 const b=S('ed-wu-q').innerHTML.toLowerCase();return b.indexOf('x-ray')>=0&&b.indexOf('troponin')<0;});
t('ED site dropdown loads',()=>{reset();edSiteInit();return /optgroup/.test(S('ed-site').innerHTML);});
done();
