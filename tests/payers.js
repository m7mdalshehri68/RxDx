/* The payer protocols: Bupa's Prerequisites document, the corrections to the
   three guides, the service-triggered lists, optional questions, readiness in
   the ledger, and the management screen that reads all of it. */
const H=require('./_harness.js');
const {code}=H.load();
const {t,done}=H.runner();
const {S,reset}=H.makeEnv();
const NAMES=['PA','ICD_MAP','paMatch','paNoteWarn','paCard','paReadiness','rxEncounter','encCapture','encList',
 'exSeedDemo','payRender','payCsv','PAY_TABS','PAY_DEPTS','_payQ','_paVia','RX_NAV','RX_LABELS','RX_EXTRA','_itcDownload'];
eval(code+'\n;Object.assign(global,{'+NAMES.join(',')+'});global.__setDl=function(f){_itcDownload=f;};');
const titles=l=>l.map(r=>r.t);
const setPayer=p=>localStorage.setItem('rxdx_payer',p);
const note=s=>{S('note-input').value=s;};
const bupa=()=>PA.req.filter(r=>r.id.indexOf('b-')===0);
const cats={};Object.keys(ICD_MAP).forEach(k=>{cats[k.split('.')[0]]=1;});
const pref={};Object.keys(ICD_MAP).forEach(k=>{if(k.length>5)pref[k.slice(0,5)]=1;});
const inAM=c=>!!ICD_MAP[c]||(c.indexOf('.')<0&&!!cats[c])||!!pref[c];

/* ── the data ── */
t('222 requirement sets, each with a unique id and title',()=>{
 const ids=new Set(PA.req.map(r=>r.id)),ts=new Set(PA.req.map(r=>r.t));
 return (PA.req.length===222&&ids.size===222&&ts.size===222)||[PA.req.length,ids.size,ts.size].join('/');});
t('Bupa Prerequisites: 151 sets, every one citing its page',()=>{
 const b=bupa(),bad=b.filter(r=>!/^Bupa Prerequisites p\.\d+$/.test(r.src||''));
 return (b.length===151&&!bad.length)||(b.length+' sets; no page: '+bad.map(r=>r.t).join(', '));});
t('every set Bupa owns asks Bupa only',()=>bupa().every(r=>r.pay.length===1&&r.pay[0]==='bupa'));
t('every matching prefix exists in ICD-10-AM',()=>{
 const bad=[];PA.req.forEach(r=>(r.px||[]).forEach(p=>{if(!Object.keys(ICD_MAP).some(k=>k.indexOf(p)===0))bad.push(r.t+':'+p);}));
 return bad.length===0||bad.slice(0,6).join(' | ');});
t('every Bupa code that is not ICD-10-AM carries a note for management',()=>{
 const bad=[];bupa().forEach(r=>(r.bx||[]).forEach(c=>{
  if(/[-–]| to /.test(c))return; if(!inAM(c.toUpperCase())&&!(r.fix&&r.fix.length))bad.push(r.t+':'+c);}));
 return bad.length===0||bad.slice(0,6).join(' | ');});
t('codes that point at the wrong condition are corrected, not copied',()=>{
 const s=PA.req.find(r=>r.t==='Sarcoidosis'),pe=PA.req.find(r=>r.t==='Pulmonary embolism'),ac=PA.req.find(r=>r.t==='Acetabular fracture');
 return s.px.join()==='D86'&&pe.px.join()==='I26'&&ac.px.join()==='S32.4'&&s.bx.join()==='J86'&&pe.bx.join()==='J81';});
t('some questions are optional, and no set is optional only',()=>{
 const n=PA.req.reduce((a,r)=>a+r.q.filter(q=>q.opt).length,0),all=PA.req.filter(r=>r.q.every(q=>q.opt)).map(r=>r.t);
 return (n>=30&&!all.length)||(n+' optional; all-optional: '+all.join(', '));});
t('every question and service pattern compiles',()=>{
 const bad=[];PA.req.forEach(r=>{r.q.forEach(q=>{try{new RegExp(q.ev,'i');}catch(e){bad.push(r.t);}});
  (r.svc||[]).concat(r.nsvc||[]).forEach(s=>{try{new RegExp(s,'i');}catch(e){bad.push(r.t+' svc');}});});
 return bad.length===0||bad.join(' | ');});
t('no pattern can hang on a long note',()=>{
 const long=('word '.repeat(4000))+' 120/80 ';const t0=Date.now();
 PA.req.forEach(r=>r.q.forEach(q=>new RegExp(q.ev,'i').test(long)));
 return Date.now()-t0<1500||('took '+(Date.now()-t0)+' ms');});
t('a list borrowed for another payer says so, and from whom',()=>{
 const v=PA.req.filter(r=>r.via&&r.via.length);
 const bad=v.filter(r=>r.via.some(p=>r.pay.indexOf(p)<0)||!/comes from/.test(_paVia(r,'')));
 return (v.length>=10&&!bad.length)||(v.length+' borrowed; bad: '+bad.map(r=>r.t).join(', '));});
t('Bupa lists its own devices, formula and extensions — Tawuniya no longer stands in',()=>
 ['Glucometer','Insulin pump','Milk formula','Growth hormone','Admission extension','Nebuliser','Hearing aid']
  .every(n=>PA.req.find(r=>r.t===n).pay.indexOf('bupa')<0));

/* ── the three guides, corrected ── */
t('rules Bupa never wrote are no longer credited to Bupa',()=>{
 const f=s=>PA.rules.find(r=>r.r.indexOf(s)===0);
 return ['Dispensing a sunglasses frame','Dental: request only the treatment','Inpatient extensions stay under']
  .every(s=>f(s)&&f(s).pay.indexOf('bupa')<0);});
t('Tawuniya names no imaging: CT, MRI and PET are Bupa and Al Rajhi',()=>
 ['CT scan','MRI','PET scan and advanced imaging'].every(s=>PA.trig.find(x=>x.s===s).pay.join()==='bupa,art'));
t('the rules that were missing are there',()=>
 PA.rules.some(r=>/EMR request type/.test(r.r)&&r.pay.join()==='art')&&
 PA.rules.some(r=>/walk-in/.test(r.r)&&r.pay.join()==='bupa')&&
 PA.rules.some(r=>/Bupa still requires it/.test(r.r))&&
 PA.rules.some(r=>/SBS circular/.test(r.r))&&
 PA.rules.some(r=>/refused most often/.test(r.r)));
t('the optical list no longer claims all three payers',()=>
 !PA.req.find(r=>r.t==='Optical benefit').no.some(x=>/all three/.test(x)));
t('every payer lists the documents it was read from',()=>PA.payers.every(p=>p.docs&&p.docs.length&&p.docs.every(d=>d.p>0)));

/* ── matching ── */
t('an MRI request raises Bupa\'s MRI list with no diagnosis at all',()=>{
 reset();setPayer('bupa');note('Low back pain for 3 months. Plan: MRI lumbar spine.');
 return titles(paMatch('bupa','',[],'')).indexOf('MRI')>=0||titles(paMatch('bupa','',[],'')).join();});
t('the MRI list stays silent when no MRI is written, and for Tawuniya',()=>{
 reset();note('Low back pain for 3 months. Plan: physiotherapy review.');
 const a=titles(paMatch('bupa','',[],''));reset();note('Plan: MRI lumbar spine.');
 const b=titles(paMatch('taw','',[],''));
 return (a.indexOf('MRI')<0&&b.indexOf('MRI')<0)||(a.join()+' || '+b.join());});
t('an appendicitis code raises Bupa\'s appendicitis list — and not for Tawuniya',()=>{
 reset();note('RIF pain.');
 return titles(paMatch('bupa','',['K35.8'],'')).indexOf('Appendicitis')>=0&&
  !paMatch('taw','',['K35.8'],'').some(r=>r.id.indexOf('b-')===0);});
t('sarcoidosis is found on D86, not on pyothorax',()=>{
 reset();return titles(paMatch('bupa','',['D86.0'],'')).indexOf('Sarcoidosis')>=0&&
  titles(paMatch('bupa','',['J86.9'],'')).indexOf('Sarcoidosis')<0;});
t('the outpatient hypertension list stands down in an admission',()=>{
 reset();note('Hypertensive, headache. Admitted to the ward for monitoring.');
 const l=titles(paMatch('bupa','',['I10'],''));
 return (l.indexOf('Essential hypertension — outpatient')<0&&l.indexOf('Essential hypertension — inpatient')>=0)||l.join();});
t('a formula list waits until formula is written',()=>{
 reset();note('Infant with bloody stools, suspected cow\'s milk protein allergy.');
 const a=titles(paMatch('bupa','',['Z91.0'],''));
 note('Cow\'s milk protein allergy. Start extensively hydrolysed formula.');
 const b=titles(paMatch('bupa','',['Z91.0'],''));
 return (a.indexOf('Cow\'s milk protein allergy — formula')<0&&b.indexOf('Cow\'s milk protein allergy — formula')>=0)||(a.join()+' || '+b.join());});
t('capillary refill time does not raise a CRT device',()=>{
 reset();note('Child, CRT < 2 seconds, well perfused.');
 return titles(paMatch('bupa','',[],'')).indexOf('CRT device')<0;});
t('a ureteric stent does not raise PCI',()=>{
 reset();note('Renal colic. Plan: DJ stent insertion.');
 return titles(paMatch('bupa','',[],'')).indexOf('PCI')<0;});
t('knee extension in a physio note does not raise an extension of stay',()=>{
 reset();note('Knee extension 0 to 120 degrees. Plan: physiotherapy sessions.');
 return titles(paMatch('bupa','',[],'')).indexOf('Extension of stay')<0;});
t('a search finds a list by its ICD code',()=>titles(paMatch('bupa','',[],'k35')).indexOf('Appendicitis')>=0);

/* ── optional questions ── */
t('an optional item is never counted as missing',()=>{
 reset();setPayer('bupa');S('hx-input').value='Back pain';
 note('History: low back pain for 3 months. Impression: lumbar disc prolapse. Plan: MRI lumbar spine.');
 const w=paNoteWarn('hx');return !/MRI/.test(w||'')||w;});
t('the payer card marks it "if available"',()=>{
 const r=PA.req.find(x=>x.t==='MRI');return /if available/.test(paCard(r,'bupa','',true));});

/* ── the visit screen and the API ── */
t('the visit engine raises the MRI list when the note asks for one',()=>{
 const r=rxEncounter({complaint:'Back pain',payer:'bupa',note:'Low back pain for 3 months, radiating to the leg. Plan: MRI lumbar spine.'});
 return r.payerRequirements.some(x=>x.title==='MRI')||r.payerRequirements.map(x=>x.title).join();});
t('optional questions are flagged and never listed as still missing',()=>{
 const r=rxEncounter({complaint:'Back pain',payer:'bupa',note:'Plan: MRI lumbar spine.'});
 const m=r.payerRequirements.find(x=>x.title==='MRI');
 return m&&m.questions.some(q=>q.optional)&&!r.stillMissing.some(x=>x.requirement==='MRI'&&/if there was trauma|if any|if done/.test(x.ask));});
t('Tawuniya\'s chest pain list is unchanged',()=>{
 const r=rxEncounter({complaint:'Chest pain',payer:'taw',note:'Central chest pain.'});
 return r.payerRequirements.some(x=>x.title==='Acute chest pain');});

/* ── the ledger ── */
t('readiness records the payer, the lists and the unanswered questions',()=>{
 reset();setPayer('bupa');S('hx-input').value='Abdominal pain';window._hxDx=[{code:'K35.8'}];note('RIF pain since this morning.');
 const p=paReadiness('hx');
 return (p.py==='bupa'&&p.ps.indexOf('b-git-appendicitis')>=0&&p.pm.length>0&&p.pm.every(k=>_payQ(k)))||JSON.stringify(p);});
t('a finalised note carries it into the ledger — ids and counts, no text',()=>{
 reset();localStorage.removeItem('rxdx_enc_v1');setPayer('taw');S('hx-input').value='Chest pain';window._hxDx=[{code:'I20.0'}];
 note('Central chest pain.');encCapture('hx','final',false);
 const r=encList()[0];
 return (r&&r.py==='taw'&&Array.isArray(r.pm)&&r.pm.every(k=>/^[pb]-[a-z0-9-]+:\d+$/.test(k))&&typeof r.pq==='number')||JSON.stringify(r);});

/* ── the management screen ── */
t('management sees the new screen',()=>!!(RX_NAV.admin.some(g=>g[1].indexOf('payers')>=0)&&RX_LABELS.payers&&RX_EXTRA.payers));
t('every tab draws',()=>{
 const bad=[];PAY_TABS.forEach(x=>{sessionStorage.setItem('rx_pay_tab',x[0]);S('pay-body').innerHTML='';
  try{payRender();if(!(S('pay-body').innerHTML||'').length)bad.push(x[0]+' empty');}catch(e){bad.push(x[0]+': '+e.message);}});
 return bad.length===0||bad.join(' | ');});
t('the service matrix has a row for every service',()=>{
 sessionStorage.setItem('rx_pay_tab','when');sessionStorage.removeItem('rx_pay_when');payRender();
 const rows=(S('pay-body').innerHTML.match(/<td class="pay-(y|no)">/g)||[]).length;
 return rows===PA.trig.length*3||rows;});
t('code issues lists every Bupa set that needs one',()=>{
 sessionStorage.setItem('rx_pay_tab','codes');payRender();
 const n=PA.req.filter(r=>r.fix&&r.fix.length).length,rows=(S('pay-body').innerHTML.match(/<tr><td><b>/g)||[]).length;
 return (n>=50&&rows===n)||(n+' / '+rows);});
t('every department opens',()=>{
 const bad=[];PAY_DEPTS.forEach(d=>{sessionStorage.setItem('rx_pay_tab','dept');sessionStorage.setItem('rx_pay_dept',d.id);
  try{payRender();if(S('pay-body').innerHTML.indexOf(d.n.replace(/&/g,'&amp;'))<0)bad.push(d.id);}catch(e){bad.push(d.id+': '+e.message);}});
 return bad.length===0||bad.join(' | ');});
t('pharmacy owns the drug lists',()=>{
 sessionStorage.setItem('rx_pay_tab','dept');sessionStorage.setItem('rx_pay_dept','phar');payRender();
 const h=S('pay-body').innerHTML;return /GLP-1/.test(h)&&/Biological agent/.test(h)&&/Tawuniya/.test(h);});
t('readiness reads the ledger',()=>{
 localStorage.setItem('rxdx_exdemo','1');localStorage.removeItem('rxdx_encdemo_v1');exSeedDemo();
 sessionStorage.setItem('rx_pay_tab','ready');payRender();const h=S('pay-body').innerHTML;
 localStorage.removeItem('rxdx_exdemo');
 return (/By payer/.test(h)&&/\d+%/.test(h)&&/most often leave unanswered/.test(h))||h.slice(0,200);});
t('the library exports every question',()=>{
 let got='';__setDl((n,txt)=>{got=txt;});sessionStorage.setItem('rx_pay_tab','over');
 sessionStorage.setItem('rx_pay_tab','anc');payCsv();
 const lines=got.split('\r\n').length-1,n=PA.req.reduce((a,r)=>a+r.q.length,0);
 return lines===n||(lines+' / '+n);});
done();
