/* The nine changes asked for, each held in place by a test. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code,html}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{uniFilter,uniSearch,cxCanon,cxAllNames,CX_ALIAS,PRESENTATIONS,'+
 'hxRender,hxMdsRender,hxPaLook,paSetPayer,paPayer,dcAnalyse,clinCard,CLIN,edClock,_stProblems,hxDxAdd,window});');
const {t,done}=runner();

/* 1 — the search can be narrowed */
t('the search offers diagnoses-only and drugs-only',()=>
 /data-k="dx"/.test(html)&&/data-k="drug"/.test(html));
t('the filter is hidden until something is searched',()=>{reset();
 S('uni-input').value='';uniSearch();
 return S('uni-filter').style.display==='none';});
t('choosing diagnoses only drops the drug half',()=>{reset();
 S('uni-input').value='metformin';uniFilter('dx');
 return !/Drugs</.test(S('uni-out').innerHTML)||'drugs still shown';});
t('choosing drugs only drops the diagnosis half',()=>{reset();
 S('uni-input').value='diabetes';uniFilter('drug');
 return !/Diagnoses</.test(S('uni-out').innerHTML)||'diagnoses still shown';});
t('everything is the default again after a reset',()=>{reset();
 uniFilter('all');S('uni-input').value='diabetes';uniSearch();
 return /Diagnoses</.test(S('uni-out').innerHTML);});

/* 2 and 3 — the two small boxes */
t('the drug formulary search box is enlarged',()=>/id="idf-input"/.test(html)&&/search-big" id="idf-input"/.test(html));
t('the ICD search box is enlarged',()=>/search-big" id="icd-input"/.test(html));
t('the enlargement is a real style, not an empty class',()=>/\.search-big\{font-size:16\.5px/.test(html));

/* 4 — Note → Codes is stripped back */
t('the dictation language chooser is gone',()=>!/rxDictSetLang\(this\.value\)/.test(html));
t('the microphone is gone from the note box',()=>!/rxDictate\('note-input'/.test(html));
t('the "explain every code" checkbox is gone',()=>!/id="note-teach"/.test(html));
t('but the note analyser still works',()=>{reset();
 const r=_stProblems('Impression: community acquired pneumonia.',' impression: community acquired pneumonia. ');
 return r.some(x=>x.code==='J18.9')||r.map(x=>x.code).join();});

/* 5 — the emergency countdown */
t('the 24-hour countdown no longer shows anything',()=>{reset();
 S('ed-arrival').value='2026-01-01T08:00';
 edClock();
 return S('ed-clock').textContent===''||('still says: '+S('ed-clock').textContent);});
t('no countdown text remains in the page',()=>!/h left to submit/.test(html)&&!/24-hour window passed/.test(html));

/* 6 — the History Builder knows every name */
t('a doctor can type any name the protocols use',()=>cxAllNames().length>=230||('only '+cxAllNames().length));
t('an alias resolves to a real presentation',()=>{
 const bad=Object.keys(CX_ALIAS).filter(k=>CX_ALIAS[k]&&!PRESENTATIONS[CX_ALIAS[k]]);
 return bad.length===0||('aliases pointing nowhere: '+bad.join());});
t('typing an alias rewrites it to the presentation',()=>{reset();
 S('hx-input').value='Fainting';hxRender();
 return S('hx-input').value==='Syncope / blackout'||S('hx-input').value;});
t('a real presentation is left alone',()=>{reset();
 S('hx-input').value='Chest pain';hxRender();
 return S('hx-input').value==='Chest pain';});
t('nonsense is not silently rewritten',()=>{reset();
 S('hx-input').value='qqqq';hxRender();
 return S('hx-input').value==='qqqq';});

/* 7 — discharge coding */
t('discharge coding produces codes',()=>{reset();
 S('dc-adm').value='Community acquired pneumonia';
 S('dc-course').value='Developed acute kidney injury on day 3';
 dcAnalyse();
 const h=S('dc-out').innerHTML;
 return (/J18/.test(h)&&/N17/.test(h))||h.slice(0,160);});
t('"acute kidney injury" is no longer read as a traumatic kidney injury',()=>{reset();
 const r=_stProblems('Developed acute kidney injury on day 3.',' developed acute kidney injury on day 3. ');
 return !r.some(x=>x.code==='S37.00')||'S37.00 still appears';});
t('a longer phrase swallows the shorter one inside it',()=>{
 const r=_stProblems('Impression: pleuritic chest pain.',' impression: pleuritic chest pain. ');
 const c=r.map(x=>x.code);
 return !(c.includes('R07.1')&&c.includes('R07.4'))||c.join();});

/* 8 — clinical indications as a path */
t('a protocol renders as stages, not paragraphs',()=>{
 const d=CLIN.find(x=>x.v===1&&x.ind&&x.red);
 const h=clinCard(d,true);
 return (/class="cstep /.test(h)&&!/nat-i/.test(h))||'still rendering as paragraphs';});
t('each stage is labelled and counted',()=>{
 const d=CLIN.find(x=>x.v===1&&x.ind);
 const h=clinCard(d,true);
 return (/cstep-h/.test(h)&&/cstep-n/.test(h))||'no stage heading or count';});
t('red flags are coloured as red flags',()=>{
 const d=CLIN.find(x=>x.v===1&&x.red&&x.red.length);
 return /cstep st-red/.test(clinCard(d,true));});
t('a document with nothing to show still says so',()=>{
 const d=CLIN.find(x=>!x.ind&&!x.when&&!x.mgmt&&!x.flow);
 return d? /clin-note/.test(clinCard(d,true)) : true;});

/* 9 — pre-authorisation inside the builder */
t('the insurer can be chosen where the questions are answered',()=>{reset();
 S('hx-input').value='Chest pain';hxDxAdd('I20.0');hxMdsRender();
 return /paSetPayer/.test(S('hx-mds').innerHTML)||'no insurer control in the builder';});
t('switching the insurer changes what is asked',()=>{reset();
 paSetPayer('taw');const a=paPayer();paSetPayer('bupa');const b=paPayer();paSetPayer('taw');
 return (a==='taw'&&b==='bupa')||(a+'/'+b);});
t('a service can be checked before it is ordered',()=>{reset();
 S('hx-pa-look').value='arthroplasty';hxPaLook();
 const h=S('hx-pa-look-out').innerHTML;
 return /pa-look/.test(h)&&/question/.test(h)||h.slice(0,140);});
t('the look-ahead says plainly when it finds nothing',()=>{reset();
 S('hx-pa-look').value='zzzznothing';hxPaLook();
 return /Nothing in the three protocols/.test(S('hx-pa-look-out').innerHTML);});
t('it stays quiet until enough is typed',()=>{reset();
 S('hx-pa-look').value='ar';hxPaLook();
 return S('hx-pa-look-out').innerHTML==='';});
done();
