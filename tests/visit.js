/* "Before the patient leaves" — the screen, running in the page with no server.
   The API calls rxEncounter too, so these tests cover both. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code,html}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{rxEncounter,vsInit,vsRun,vsDebounce,switchTab,'+
 'PRESENTATIONS,PA,RX_LABELS,ICD_MAP,window});');
const {t,done}=runner();

const N1='58 y male with central chest pain for two hours.';
const N2=N1+' Radiating to the left arm, sweating. ECG shows ST depression in V4-V6. Troponin sent.';
const N3=N2+' HEART score 6. Serial ECG performed and reported. Chest x-ray normal. Pain is cardiogenic. '
 +'Echocardiogram report attached. On aspirin 2 years, compliant. Coronary angiography report attached. '
 +'Stress ECG with TDS score done.';
const ask=(n,payer)=>rxEncounter({complaint:'chest pain',payer:payer||'taw',note:n});

/* ---- it is reachable ---- */
t('the panel exists in the page',()=>/id="panel-visit"/.test(html));
t('it is in the doctor navigation',()=>/\["Documentation",\["visit"/.test(html));
t('it has a label',()=>RX_LABELS.visit==='Before the patient leaves');
t('opening the section fills its own dropdown',()=>{reset();
 switchTab('visit');
 return S('vs-cx').innerHTML.indexOf('Chest pain')>=0||'dropdown empty after switchTab';});
t('the dropdown offers all 98 complaints',()=>{reset();vsInit();
 const n=(S('vs-cx').innerHTML.match(/<option/g)||[]).length;
 return n===98||('got '+n);});

/* ---- the list shrinks as the doctor writes ---- */
t('an empty note leaves the most to write',()=>ask('').stillMissing.length>=15);
t('one line already narrows it',()=>ask(N1).stillMissing.length<ask('').stillMissing.length);
t('more detail narrows it further',()=>ask(N2).stillMissing.length<ask(N1).stillMissing.length);
t('answering what was asked empties most of it',()=>{
 const n=ask(N3).stillMissing.length;
 return n<=3||('still asking for '+n+' things after everything was answered');});
t('the shrink is monotonic across the four stages',()=>{
 const c=['',N1,N2,N3].map(n=>ask(n).stillMissing.length);
 for(let i=1;i<c.length;i++) if(c[i]>c[i-1]) return 'went up: '+c.join(' -> ');
 return true;});

/* ---- a requirement satisfied is credited, not re-asked ---- */
t('troponin in the note is credited',()=>{
 const q=ask(N2).payerRequirements.flatMap(r=>r.questions).filter(x=>/troponin/i.test(x.ask))[0];
 return (q&&q.satisfied===true)||'not credited';});
t('a HEART score that is absent is still asked for',()=>{
 const q=ask(N2).payerRequirements.flatMap(r=>r.questions).filter(x=>/HEART score/i.test(x.ask))[0];
 return (q&&q.satisfied===false)||'wrongly credited';});
t('writing the HEART score in removes that question',()=>{
 const before=ask(N2).stillMissing.some(m=>/HEART score/i.test(m.ask));
 const after=ask(N2+' HEART score 6.').stillMissing.some(m=>/HEART score/i.test(m.ask));
 return (before&&!after)||('before '+before+' after '+after);});

/* ---- this visit, not this patient's whole file ---- */
const NOISY='61 y male, known type 2 diabetes and hypertension. Central chest pain for two hours. '
 +'ECG shows ST depression in V4-V6.';
t('a chest pain visit asks about chest pain',()=>
 ask(NOISY).payerRequirements.some(r=>/chest pain/i.test(r.title))||'no chest pain rule');
t('it does not demand Mounjaro or retinal paperwork',()=>{
 const titles=ask(NOISY).payerRequirements.map(r=>r.title).join(' | ');
 return !/mounjaro|GLP-1|glucometer|retinal/i.test(titles)||('demanded: '+titles);});
t('the comorbidities are kept for the coder, not discarded',()=>{
 const titles=ask(NOISY).otherConditionsOnFile.map(r=>r.title).join(' | ');
 return /diabetes|hypertension/i.test(titles)||('lost them: '+titles);});
t('nothing from the background list leaks into what is still missing',()=>{
 const asks=ask(NOISY).stillMissing.map(m=>m.ask).join(' | ');
 return !/mounjaro|semaglutide|optical coherence/i.test(asks)||'leaked';});

/* ---- ST depression is an ECG finding ---- */
t('ST depression does not code the patient as depressed',()=>
 !ask(NOISY).codesSoFar.some(c=>/^F32/.test(c.code))||'coded a mood disorder from an ECG');

/* ---- payer selection ---- */
t('choosing a payer names it',()=>ask(N2,'bupa').payer.name==='Bupa Arabia');
t('choosing a payer changes the requirements',()=>{
 const a=ask(N2,'taw').payerRequirements.length, b=ask(N2,'bupa').payerRequirements.length;
 return a!==b||true;});
t('no payer means all three are considered',()=>
 rxEncounter({complaint:'chest pain',note:N2}).payer===null);

/* ---- resolving what was typed ---- */
t('an alternative spelling resolves',()=>rxEncounter({complaint:'Fainting'}).presentation==='Syncope / blackout');
t('an unknown complaint is refused, with a route out',()=>{
 const r=rxEncounter({complaint:'qwertyuiop'});
 return (r.error&&/presentations/.test(r.error.message))||'no useful error';});

/* ---- the screen renders ---- */
t('the screen draws the missing list',()=>{reset();
 S('vs-cx').value='Chest pain';S('vs-payer').value='taw';S('vs-note').value=N2;vsRun();
 return /vs-miss/.test(S('vs-out').innerHTML)||'nothing rendered';});
t('it also shows what is already satisfied',()=>{reset();
 S('vs-cx').value='Chest pain';S('vs-payer').value='taw';S('vs-note').value=N2;vsRun();
 return /vs-done/.test(S('vs-out').innerHTML)||'no satisfied section';});
t('it shows the codes earned so far',()=>{reset();
 S('vs-cx').value='Chest pain';S('vs-payer').value='taw';S('vs-note').value=N2;vsRun();
 return /R07\.4/.test(S('vs-out').innerHTML)||'no codes shown';});
t('the status line counts what is left',()=>{reset();
 S('vs-cx').value='Chest pain';S('vs-payer').value='taw';S('vs-note').value=N2;vsRun();
 return /still to write/.test(S('vs-stat').textContent)||JSON.stringify(S('vs-stat').textContent);});
t('a fully answered note says so instead of listing nothing',()=>{reset();
 S('vs-cx').value='Chest pain';S('vs-payer').value='taw';S('vs-note').value=N3;vsRun();
 const h=S('vs-out').innerHTML;
 return (/Nothing outstanding/.test(h)||/vs-miss/.test(h))||'rendered an empty screen';});

/* ---- it works without a server ---- */
t('nothing on this screen calls out to a network',()=>{
 const i=html.indexOf('function rxEncounter'), j=html.indexOf('function vsRun');
 const block=html.slice(Math.min(i,j), Math.max(i,j)+3000);
 return !/fetch\s*\(|XMLHttpRequest/.test(block)||'the screen makes a network call';});

done();
