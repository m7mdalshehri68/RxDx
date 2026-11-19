/* Coding with Claude. Claude itself is not called here: its answers are
   written out by hand, including the wrong ones it can give (an ICD-10-CM
   code, a bare category, a quote that is not in the note, a denied finding
   called active), and each test checks what RxDx does with them. */
const path=require('path');
const {load,makeEnv}=require('./_harness.js');
const {code,html}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{aicDeid,aicValidate,aicNearest,aicSim,aicCrossCheck,aicRestore,aicOn,aicConsented,'+
 'analyzeNote,noteProblems,_stProblems,ICD_MAP,SYN,AIC_FLAG,AIC_WHY,AIC_STATUS,AIC_ROLE,'+
 'setAicUrl:function(u){AIC_URL=u;}});');

let P=0,F=0;
const ok=(c,m)=>{if(c)P++;else{F++;console.log('  FAIL',m);}};
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
const item=(text,code,o)=>Object.assign({text,condition:(o&&o.title)||text,status:'active',role:'secondary',code,title:(o&&o.title)||(ICD_MAP[code]?ICD_MAP[code].ascii_desc:'')},o||{});
const codes=r=>r.coded.map(x=>x.code);

(async()=>{
/* ---------- the same identifiers are removed here and on the gateway ---------- */
{
  const gw=(await import(require('url').pathToFileURL(path.join(__dirname,'..','gateway','load.mjs')).href)).default;
  const samples=['Patient name: Ahmed Saleh. MRN: 4458921. National ID 1098765432, Iqama 2456789012.',
    'Mobile 0551234567, +966 55 123 4567, email a.saleh@mail.com. Seen 12/03/2026, 2026-03-14, 3 March 2026, March 3, 2026.',
    'Mr Khalid Al Harbi brought him. Dr. Fawaz reviewed. محمد الشهري. Address: Tabuk, Al Muruj district.',
    '45 year old with HbA1c 8.2%, BP 118/72, 3/7 history of cough, E11.9, CKD stage 3. MR and MS noted.'];
  samples.forEach((s,i)=>{const a=aicDeid(s),b=gw.deid(s);ok(a.text===b.text&&a.removed===b.removed,'browser and gateway remove the same things ('+i+'): '+a.text+' | '+b.text);});
  const d=aicDeid(samples.join(' '));
  ok(!/Ahmed|Saleh|4458921|1098765432|2456789012|0551234567|a\.saleh|Khalid|Fawaz|Tabuk/.test(d.text),'identifiers removed: '+d.text);
  ok(!/[؀-ۿ]/.test(d.text),'no Arabic leaves the device');
  ok(/HbA1c 8\.2%/.test(d.text)&&/BP 118\/72/.test(d.text)&&/3\/7 history/.test(d.text)&&/CKD stage 3/.test(d.text)&&/MR and MS noted/.test(d.text),'clinical content kept');
}

/* ---------- Claude's codes are checked against ICD-10-AM ---------- */
{
  const note='Known type 2 diabetes with diabetic nephropathy, diabetic retinopathy and peripheral neuropathy. Poorly controlled. No chest pain. Mother had breast cancer.';
  const r=aicValidate(note,[
    item('type 2 diabetes with diabetic nephropathy','E11.22',{role:'principal'}),
    item('diabetic retinopathy','E11.31'),item('peripheral neuropathy','E11.42'),item('Poorly controlled','E11.65'),
    item('diabetic retinopathy','E11.31'),
    item('No chest pain','R07.4',{status:'negated'}),
    item('Mother had breast cancer','Z80.3',{status:'family'})],{});
  ok(codes(r).join()==='E11.22,E11.31,E11.42,E11.65','every complication keeps its own code: '+codes(r));
  ok(r.principal==='E11.22'&&r.coded[0].role==='principal','principal first');
  ok(r.refused.length===2&&r.refused[0].why===AIC_STATUS.negated&&r.refused[1].why===AIC_STATUS.family,'denied and family findings are listed, not coded');
  ok(r.coded.every(x=>!x.flags.length),'clean codes carry no warning');
}
{
  const note='Fell from a ladder at home. X-ray: fracture of distal radius.';
  const r=aicValidate(note,[
    item('fracture of distal radius','S52.501A',{role:'principal',title:'Unspecified fracture of the lower end of right radius, initial encounter'}),
    item('Fell from a ladder','W11',{role:'external_cause'}),
    item('at home','Y92.09',{role:'place'}),item('','U73.9',{role:'activity'})],{});
  ok(r.coded[0].code==='S52.50'&&r.coded[0].from==='S52.501A'&&r.coded[0].flags.indexOf('fixed')>=0,'an ICD-10-CM code is moved to ICD-10-AM: '+JSON.stringify(r.coded[0]));
  ok(codes(r).join()==='S52.50,W11,Y92.09,U73.9','injury keeps its external cause, place and activity: '+codes(r));
}
{
  const note='Impression: type 2 diabetes with hypoglycaemia.';
  const r=aicValidate(note,[item('type 2 diabetes with hypoglycaemia','E11',{role:'principal',title:'Type 2 diabetes mellitus with hypoglycaemia'})],{});
  ok(codes(r).join()==='E11.64'&&r.coded[0].flags.indexOf('fixed')>=0,'a bare category becomes the code its title names: '+codes(r));
}
{
  const note='Impression: zygomycosis of the left frontal sinus.';
  const r=aicValidate(note,[item('zygomycosis of the left frontal sinus','Q99.99',{role:'principal',title:'Totally unrelated thing'})],{});
  ok(!r.coded.length&&r.review.length===1&&r.review[0].why==='notam'&&r.review[0].alts.length>0,'a code that is not ICD-10-AM and matches nothing goes to the coder with candidates');
}
{
  const note='Chest pain resolved. Impression: lower respiratory tract infection.';
  const r=aicValidate(note,[
    item('lower respiratory tract infection','J22',{role:'principal'}),
    item('Chest pain','R07.4'),
    item('community acquired pneumonia','J18.9')],{});
  ok(codes(r).join()==='J22','only the supported code is coded: '+codes(r));
  ok(r.review.some(x=>x.why==='engine'&&x.code==='R07.4'),'a finding the note calls resolved is sent back for review');
  ok(r.review.some(x=>x.why==='quote'&&x.code==='J18.9'),'a code with no words behind it in the note is not coded');
}
{
  const note='Benign prostatic hyperplasia with urinary retention.';
  const r=aicValidate(note,[item('Benign prostatic hyperplasia','N40',{role:'principal'})],{sex:'female'});
  ok(r.coded[0].flags.indexOf('sex')>=0,'a male-only code in a female patient is flagged');
}
{
  const pdx=Object.keys(ICD_MAP).find(c=>ICD_MAP[c].UnacceptPDx===1&&/^Z/.test(c));
  const note='Reason: '+ICD_MAP[pdx].ascii_desc+'. Also essential hypertension.';
  const r=aicValidate(note,[item(ICD_MAP[pdx].ascii_desc,pdx,{role:'principal'}),item('essential hypertension','I10')],{});
  ok(r.principal==='I10'&&r.coded.find(x=>x.code===pdx).flags.indexOf('pdx')>=0,'a code not accepted as principal is moved down: '+pdx+' → '+r.principal);
}
{
  const note='32 weeks pregnant with gestational diabetes on diet.';
  const r=aicValidate(note,[item('gestational diabetes on diet','O24.42',{role:'principal',title:'Gestational diabetes mellitus, diet controlled'})],{});
  ok(r.coded[0].flags.indexOf('meaning')>=0&&r.coded[0].alts.length>0,'a code whose ICD-10-AM title says something else is flagged with alternatives');
}
{
  const note='Past history of tuberculosis, fully treated. Impression: asthma.';
  const r=aicValidate(note,[item('asthma','J45.9',{role:'principal'}),item('Past history of tuberculosis','Z86.11',{status:'history'})],{});
  const z=Object.keys(ICD_MAP).indexOf('Z86.11')>=0;
  ok(!z||(codes(r).indexOf('Z86.11')>=0&&r.coded.find(x=>x.code==='Z86.11').role==='secondary'),'a personal-history Z code is kept as secondary');
}
ok(aicValidate('x',null,{}).coded.length===0&&aicValidate('x',[null,'a',{}],{}).coded.length===0,'a malformed answer codes nothing');

/* ---------- the word list still runs beside Claude ---------- */
{
  const note='Impression: asthma. Known hypertension. 32 weeks pregnant, anaemia in pregnancy.';
  const r=aicCrossCheck(note,aicValidate(note,[item('asthma','J45.9',{role:'principal'}),item('anaemia in pregnancy','O99.01')],{}));
  const wl=r.wordList.map(x=>x.code);
  ok(wl.indexOf('I10')>=0,'a condition only the word list found is shown: '+wl);
  ok(wl.indexOf('D64.9')<0,'a phrase Claude already coded is not repeated');
  ok(wl.indexOf('Z33')<0,'Z33 is not offered beside an obstetric code');
}

/* ---------- the two vocabulary entries that gave a wrong code ---------- */
{
  const p=n=>_stProblems(n,' '+n.toLowerCase()+' ').map(x=>x.code);
  ok(p('Impression: lower respiratory tract infection.').join()==='J22','LRTI is J22, not a pneumonia code: '+p('Impression: lower respiratory tract infection.'));
  ok(p('Impression: diabetic retinopathy.').indexOf('H35.0')<0,'diabetic retinopathy no longer earns H35.0');
  ok(p('Impression: community acquired pneumonia.').join()==='J18.9','pneumonia is unchanged');
}

/* ---------- the screen ---------- */
ok(/id="aic-on"/.test(html)&&/id="aic-url"/.test(html)&&/id="aic-warn"/.test(html)&&/id="note-hint"/.test(html),'the switch is on the Note screen');
{
  const m=html.match(/window\.RX_I18N_AR=(\{[\s\S]*?\});\nwindow\.RX_I18N_AR_PAT/);
  const AR=m?JSON.parse(m[1]):{};
  const need=[].concat(Object.values(AIC_FLAG),Object.values(AIC_WHY),Object.values(AIC_STATUS),Object.values(AIC_ROLE),
    ['Code with Claude (AI)','Before Claude reads this note','Agree and code with Claude','Code offline instead','Claude is reading the note…',
     'Check before use','Also found by the word list','Read and not coded','What was sent to Claude','Identifiers removed',
     'Checked against ICD-10-AM','Claude · checked against ICD-10-AM','offline engine · Claude was unreachable','connected','coded by Claude']);
  const miss=need.filter(k=>!AR[k]);
  ok(!miss.length,'every new label has Arabic: missing '+JSON.stringify(miss));
}
{
  reset(); setAicUrl('');
  aicRestore();
  ok(S('aic-on').checked===false,'off when the build carries no gateway');
  reset(); setAicUrl('https://gw.test');
  aicRestore();
  ok(S('aic-on').checked===true,'on by default when the build carries a gateway');
  reset(); localStorage.setItem('rxdx.aic',JSON.stringify({on:false,url:''}));
  aicRestore();
  ok(S('aic-on').checked===false,'a doctor who turned it off stays off');
  localStorage.removeItem('rxdx.aic');
}
{
  reset(); setAicUrl('https://gw.test'); localStorage.removeItem('rxdx.aicConsent');
  const out=S('note-out'); out.insertAdjacentHTML=(p,h)=>{out.innerHTML+=h;};
  S('aic-on').checked=true; S('note-input').value='Patient name: Ahmed Saleh. Impression: asthma.';
  let calls=0; global.fetch=()=>{calls++;return Promise.reject(0);};
  analyzeNote();
  ok(/Before Claude reads this note/.test(out.innerHTML)&&calls===0,'nothing is sent before the doctor agrees once');

  localStorage.setItem('rxdx.aicConsent','1');
  let sent=null;
  global.fetch=(url,opt)=>{sent={url,body:JSON.parse(opt.body)};return Promise.resolve({ok:true,status:200,
    json:()=>Promise.resolve({ok:true,model:'claude-haiku-5-5',deidRemoved:0,sentText:sent.body.note,
      items:[item('asthma','J45.9',{role:'principal'})]})});};
  analyzeNote(); await flush();
  ok(sent&&sent.url==='https://gw.test/code','calls the gateway');
  ok(sent&&!/Ahmed|Saleh/.test(sent.body.note)&&/\[NAME\]/.test(sent.body.note),'the name is removed before sending: '+(sent&&sent.body.note));
  ok(/J45\.9/.test(out.innerHTML)&&/Checked against ICD-10-AM/.test(out.innerHTML)&&/What was sent to Claude/.test(out.innerHTML),'draws the checked codes');
  ok(window._notePrincipal==='J45.9','principal is set for Copy all codes');

  global.fetch=()=>Promise.resolve({ok:false,status:503,json:()=>Promise.resolve({ok:false,error:'upstream'})});
  S('note-input').value='Impression: community acquired pneumonia.';
  analyzeNote(); await flush();
  ok(/J18\.9/.test(out.innerHTML)&&/Claude could not be reached/.test(S('aic-state').textContent),'falls back to the offline engine when the gateway fails');

  global.fetch=()=>Promise.reject(new Error('offline'));
  S('note-input').value='Impression: community acquired pneumonia.';
  analyzeNote(); await flush();
  ok(/J18\.9/.test(out.innerHTML),'falls back when there is no network');

  S('aic-on').checked=false; calls=0; global.fetch=()=>{calls++;return Promise.reject(0);};
  S('note-input').value='Impression: community acquired pneumonia.';
  analyzeNote(); await flush();
  ok(calls===0&&/J18\.9/.test(out.innerHTML),'switched off, nothing leaves the device');
}

console.log(P+' passed, '+F+' failed');
process.exit(F?1:0);
})().catch(e=>{console.log('  ERR',e&&e.stack||e);process.exit(1);});
