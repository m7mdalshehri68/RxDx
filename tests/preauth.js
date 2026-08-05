/* Pre-authorisation: the payer's list, checked against the note.
   A refusal for missing data is a refusal the doctor never needed to receive. */
const H=require('./_harness.js');
const {code,html}=H.load();
const {t,done}=H.runner();
const {S,reset}=H.makeEnv();
const NAMES=['PA','paMatch','paNoteWarn','paAnswered','paText','paRender','paResults','paCard',
 'paPayer','paSetPayer','paPayerName','HX_DOCS','hxDocsRender','hxDoc'];
eval(code+'\n;Object.assign(global,{'+NAMES.join(',')+'});');
const gaps=()=>{const w=paNoteWarn('hx');return w?(w.match(/pa-warn-q/g)||[]).length:0;};
const titles=w=>((w||'').match(/pa-warn-t">([^<]*)/g)||[]).map(x=>x.slice(11));

/* ── the data came out of the three protocols intact ── */
t('all three payers are present',()=>PA.payers.length===3&&
  PA.payers.map(p=>p.id).sort().join()==='art,bupa,taw');
t('every payer states its version',()=>PA.payers.every(p=>p.v&&p.v.length>4));
t('the requirement bank is not thin',()=>PA.req.length>=70||('only '+PA.req.length));
t('every condition carries questions',()=>{
 const bad=PA.req.filter(r=>!r.q||!r.q.length).map(r=>r.t);
 return bad.length===0||bad.join(' | ');});
t('every condition names at least one payer',()=>{
 const bad=PA.req.filter(r=>!r.pay||!r.pay.length).map(r=>r.t);
 return bad.length===0||bad.join(' | ');});
t('every payer named is a real payer',()=>{
 const ids=PA.payers.map(p=>p.id);
 const bad=[];PA.req.forEach(r=>r.pay.forEach(p=>{if(!ids.includes(p))bad.push(r.t+':'+p);}));
 PA.trig.forEach(r=>r.pay.forEach(p=>{if(!ids.includes(p))bad.push(r.s+':'+p);}));
 return bad.length===0||bad.join(' | ');});
t('every question can be checked against a note',()=>{
 const bad=[];PA.req.forEach(r=>r.q.forEach(q=>{
  if(!q.ev)bad.push(r.t);
  else{try{new RegExp(q.ev,'i');}catch(e){bad.push(r.t+' bad regex');}}}));
 return bad.length===0||bad.slice(0,3).join(' | ');});
t('every service pattern compiles',()=>{
 const bad=[];PA.req.forEach(r=>(r.svc||[]).forEach(s=>{
  try{new RegExp(s,'i');}catch(e){bad.push(r.t);}}));
 return bad.length===0||bad.join(' | ');});
t('the trigger list covers all three payers',()=>
 ['bupa','taw','art'].every(p=>PA.trig.filter(x=>x.pay.includes(p)).length>=35));
t('each payer has its own antenatal schedule',()=>
 ['bupa','taw','art'].every(p=>PA.anc.some(a=>a.pay===p&&a.rows.length>=4)));

/* ── it finds the right requirement set ── */
t('a complaint finds its requirements',()=>{
 const r=paMatch('taw','Chest pain',[],'');
 return r.some(x=>/Acute chest pain/.test(x.t))||r.map(x=>x.t).join();});
t('an ICD code finds its requirements',()=>
 paMatch('taw','',['E11.9'],'').length>0);
t('a search finds by name and by specialty',()=>
 paMatch('taw','',[],'biolog').length>=3&&paMatch('taw','',[],'ophthalmolog').length>=5);
t('a payer only sees its own requirements',()=>{
 const bad=[];['bupa','taw','art'].forEach(p=>
  paMatch(p,'',[],'').forEach(r=>{if(!r.pay.includes(p))bad.push(p+':'+r.t);}));
 return bad.length===0||bad.join(' | ');});

/* ── the noise problem: a procedure set stays quiet until the procedure is planned ── */
t('bypass grafting is not raised at every chest pain',()=>{
 reset();S('hx-input').value='Chest pain';S('note-input').value='Central chest pain for two hours.';
 return !titles(paNoteWarn('hx')).some(x=>/bypass|CABG/i.test(x));});
t('but it is raised the moment a bypass is planned',()=>{
 reset();S('hx-input').value='Chest pain';
 S('note-input').value='Known ischaemic heart disease, for coronary angiography and possible CABG.';
 return titles(paNoteWarn('hx')).some(x=>/bypass|Chronic coronary/i.test(x));});
t('arthroplasty is not triggered by the word osteoarthritis',()=>{
 reset();S('hx-input').value='Knee pain';
 S('note-input').value='Knee osteoarthritis, for physiotherapy and intra-articular injection.';
 return !titles(paNoteWarn('hx')).some(x=>/Arthroplasty/i.test(x));});
t('arthroplasty is triggered when a knee replacement is planned',()=>{
 reset();S('hx-input').value='Knee pain';
 S('note-input').value='Severe knee osteoarthritis, for total knee replacement.';
 return titles(paNoteWarn('hx')).some(x=>/Arthroplasty/i.test(x));});

/* ── it reads what the doctor wrote ── */
t('a thin note produces a list of what is missing',()=>{
 reset();S('hx-input').value='Chest pain';S('note-input').value='Chest pain two hours.';
 return gaps()>=5||('only '+gaps());});
t('a complete note produces nothing',()=>{
 reset();S('hx-input').value='Chest pain';
 S('note-input').value='Cardiogenic chest pain. HEART score 5. Serial ECG done. '
  +'Serial high-sensitivity troponin I sent. Chest x-ray reported.';
 return gaps()===0||('still '+gaps()+' outstanding');});
t('answers count wherever the doctor wrote them',()=>{
 reset();S('hx-input').value='Chest pain';S('hx-plan-ix').value='HEART score 4, serial ECG, troponin, chest x-ray';
 S('note-input').value='Cardiogenic.';
 return gaps()===0||('missed '+gaps());});
t('the warning names the payer',()=>{
 reset();S('hx-input').value='Chest pain';S('note-input').value='Chest pain.';
 return /Tawuniya/.test(paNoteWarn('hx'));});
t('switching payer switches the list',()=>{
 reset();S('hx-input').value='Chest pain';S('note-input').value='Chest pain.';
 paSetPayer('bupa');const b=gaps();
 paSetPayer('taw');const w=gaps();
 return b!==w||('bupa '+b+' vs tawuniya '+w);});
t('nothing here ever blocks the doctor',()=>{
 reset();S('hx-input').value='Chest pain';S('note-input').value='Chest pain.';
 return /not a rule of ours|does not block|Nothing here blocks/i.test(paNoteWarn('hx'));});

/* ── it is in the tool where a doctor will meet it ── */
t('it has its own place in the sidebar',()=>
 /\["Reference",\["clin","preauth"\]\]/.test(html)&&/id="panel-preauth"/.test(html));
t('it is a tab inside the note',()=>HX_DOCS.some(d=>d[0]==='pa'));
t('the tab carries a live count of what is missing',()=>{
 reset();S('hx-input').value='Chest pain';S('note-input').value='Chest pain.';
 hxDocsRender();return /itc-badge">\d/.test(S('hx-doctabs').innerHTML);});
t('the panel renders for every payer',()=>{
 const bad=[];['bupa','taw','art'].forEach(p=>{
  reset();paSetPayer(p);paRender('pa-out');
  if((S('pa-out-res').innerHTML||'').length<1500)bad.push(p);});
 paSetPayer('taw');return bad.length===0||bad.join();});
t('the panel shows the minimum data set, the triggers, the rules and the schedule',()=>{
 reset();paRender('pa-out');const r=S('pa-out-res').innerHTML;
 return ['Required on every request','Services that need a request','Rules that decide the outcome','antenatal']
  .every(s=>new RegExp(s,'i').test(r));});
t('search works and admits when it finds nothing',()=>{
 reset();paRender('pa-out');
 S('pa-out-q').value='insulin';paResults('pa-out');
 const hit=/Insulin pump/i.test(S('pa-out-res').innerHTML);
 S('pa-out-q').value='zzzqqq';paResults('pa-out');
 return hit&&/Nothing matches/.test(S('pa-out-res').innerHTML);});
t('hostile content is escaped',()=>{
 PA.req.push({t:'<img src=x onerror=1>',sp:'T',pay:['taw'],q:[{q:'<script>bad</script>',ev:'x'}]});
 const h=paCard(PA.req[PA.req.length-1],'taw','',true);PA.req.pop();
 return h.indexOf('<img src=x')<0&&h.indexOf('<script>bad')<0;});

/* ── the rules that refuse requests for non-clinical reasons are all there ── */
t('the 24-hour emergency rule is held',()=>
 PA.rules.some(r=>/24 hours/.test(r.r)&&r.pay.length===3));
t('the uncontracted-code rule is held',()=>
 PA.rules.some(r=>/uncontracted/i.test(r.r)));
t('the sunglasses-frame fraud rule is held',()=>
 PA.rules.some(r=>/fraud/i.test(r.r)));
t('the same-appointment dental rule is held',()=>
 PA.rules.some(r=>/one appointment/i.test(r.r)));

/* ── the union: one note that satisfies all three ── */
t('the union offers a fourth choice',()=>paPayerAll().some(p=>p.id==='all'));
t('the union is at least as strict as any single payer',()=>{
 const one=Math.max(...['bupa','taw','art'].map(p=>paMatch(p,'Chest pain',[],'').length));
 const all=paMatch('all','Chest pain',[],'').length;
 return all>=one||('union '+all+' vs strictest single '+one);});
t('the union never repeats a requirement set',()=>{
 const ts=paMatch('all','',[],'biolog').map(r=>r.t);
 return ts.length===new Set(ts).size||ts.join();});
t('the union shows every operational rule',()=>{
 reset();paSetPayer('all');paRender('pa-out');
 const r=S('pa-out-res').innerHTML;paSetPayer('taw');
 return /uncontracted/i.test(r)&&/fraud/i.test(r)&&/24 hours/.test(r);});
t('the union shows all three antenatal schedules',()=>{
 reset();paSetPayer('all');paRender('pa-out');
 const n=(S('pa-out-res').innerHTML.match(/antenatal schedule/gi)||[]).length;
 paSetPayer('taw');return n===3||('showed '+n);});
t('a single payer still shows only its own schedule',()=>{
 reset();paSetPayer('bupa');paRender('pa-out');
 const n=(S('pa-out-res').innerHTML.match(/antenatal schedule/gi)||[]).length;
 paSetPayer('taw');return n===1||('showed '+n);});
done();
