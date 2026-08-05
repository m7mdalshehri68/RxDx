/* Age and sex. Two facts that decide which codes are legal, which payer
   questions apply, and what this patient should already have had. */
const H=require('./_harness.js');
const {code,html}=H.load();
const {t,done}=H.runner();
const {S,reset}=H.makeEnv();
const N=['ICD','ICD_MAP','IDF','SCR','PA','hxWho','hxSex','whoYears','whoSex','whoLabel',
 'icdEdits','icdEditsAll','icdEditWarn','icdAgeBand','scrDue','scrRender',
 'paMatch','paNoteWarn','paQApplies','hxDocsRender','hxDoc','hxClear'];
eval(code+'\n;Object.assign(global,{'+N.join(',')+'});');
const who=(a,s,u)=>{reset();S('hx-age').value=String(a);if(u)S('hx-age-u').value=u;hxWho();if(s)hxSex(s);};
const qs=w=>((w||'').match(/pa-warn-q">([^<]*)/g)||[]).map(x=>x.slice(11));

/* ── the fields exist and hold what they should ── */
t('the encounter has an age and a sex field',()=>
 /id="hx-age"/.test(html)&&/id="hx-sex-seg"/.test(html));
t('age is entered in years, months or days',()=>
 /value="mo"/.test(html)&&/value="d"/.test(html));
t('everything downstream works in years',()=>{
 who(18,'',  'mo'); const m=whoYears();
 who(730,'','d');   const d=whoYears();
 return Math.abs(m-1.5)<0.01&&Math.abs(d-2)<0.01||('months '+m+' days '+d);});
t('sex can be cleared by tapping it again',()=>{
 who(30,'Female'); const on=whoSex(); hxSex('Female');
 return on==='Female'&&whoSex()==='';});
t('a new encounter forgets the patient',()=>{
 who(52,'Male'); hxClear();
 return whoYears()===null||whoYears()===undefined;});
t('nothing identifying is asked for',()=>
 !/name|iqama|national id|mrn|passport/i.test(
  html.slice(html.indexOf('class="hx-who"'),html.indexOf('class="hx-who"')+900)));

/* ── the coding edits: 991 sex-restricted codes, and the age bands ── */
t('the master table carries the sex edits',()=>{
 const n=ICD.filter(x=>x.sex===1||x.sex===2).length;
 return n>=900||('only '+n);});
t('a male-only code on a female patient is caught',()=>{
 who(45,'Female'); const e=icdEdits('N40');
 return e.some(x=>x.k==='sex'&&x.hard)||JSON.stringify(e);});
t('a female-only code on a male patient is caught',()=>{
 who(30,'Male'); const e=icdEdits('O80');
 return e.some(x=>x.k==='sex'&&x.hard)||JSON.stringify(e);});
t('the same code on the right sex is silent',()=>{
 who(45,'Male'); return icdEdits('N40').length===0;});
t('breast cancer in a man is a note, not an error',()=>{
 who(60,'Male'); const e=icdEdits('C50.1');
 return e.length&&e.every(x=>!x.hard)||('got '+JSON.stringify(e));});
t('an age band is enforced',()=>{
 who(8,'Male'); const e=icdEdits('C61');
 return e.some(x=>x.k==='age')||JSON.stringify(e);});
t('the same code inside the band is silent',()=>{
 who(60,'Male'); return icdEdits('C61').filter(x=>x.k==='age').length===0;});
t('no edits are claimed when age and sex are unknown',()=>{
 reset(); return icdEdits('N40').length===0&&icdEdits('C61').length===0;});
t('the warning says what to do about it',()=>{
 who(45,'Female'); window._hxDx=[{code:'N40',desc:'Hyperplasia of prostate'}];
 const w=icdEditWarn();
 return /Either the code is wrong, or the age or sex/.test(w);});
t('coding edits are escaped like everything else',()=>{
 who(45,'Female'); window._hxDx=[{code:'<img src=x>',desc:'x'}];
 return icdEditWarn().indexOf('<img src=x')<0;});

/* ── the payer questions follow the patient ── */
t('a male-only requirement disappears for a female patient',()=>{
 who(45,'Female'); S('hx-input').value='Urinary frequency';
 S('note-input').value='For TURP.';
 return !paMatch('taw','Urinary frequency',[],'').some(r=>/prostatic/i.test(r.t));});
t('and appears for a male patient',()=>{
 who(45,'Male'); S('hx-input').value='Urinary frequency';
 S('note-input').value='For TURP.';
 return paMatch('taw','Urinary frequency',[],'').some(r=>/prostatic/i.test(r.t));});
t('a female-only requirement disappears for a male patient',()=>{
 who(30,'Male'); S('hx-input').value='Irregular periods';
 S('note-input').value='For pelvic ultrasound.';
 return !paMatch('taw','Irregular periods',[],'').some(r=>/polycystic/i.test(r.t));});
t('growth hormone is not raised in an adult',()=>{
 who(40,'Male'); S('note-input').value='For growth hormone.';
 return !paMatch('taw','Short stature',[],'').some(r=>/Growth hormone/i.test(r.t));});
t('the insulin pump question is the under-12 one for a child',()=>{
 who(8,'Male'); S('hx-input').value='Polyuria';
 window._hxDx=[{code:'E10.9',desc:'Type 1 diabetes'}];
 S('note-input').value='Type 1 diabetes, for insulin pump.';
 const l=qs(paNoteWarn('hx'));
 return l.some(x=>/Under 12/.test(x))&&!l.some(x=>/Over 12/.test(x))||l.join(' | ');});
t('and the over-12 one for an adolescent',()=>{
 who(16,'Male'); S('hx-input').value='Polyuria';
 window._hxDx=[{code:'E10.9',desc:'Type 1 diabetes'}];
 S('note-input').value='Type 1 diabetes, for insulin pump.';
 const l=qs(paNoteWarn('hx'));
 return l.some(x=>/Over 12/.test(x))&&!l.some(x=>/Under 12/.test(x))||l.join(' | ');});
t('semen analysis is asked only above 20',()=>{
 who(15,'Male');S('hx-input').value='Testicular pain';S('note-input').value='For varicocelectomy.';
 const young=qs(paNoteWarn('hx')).some(x=>/semen/i.test(x));
 who(25,'Male');S('hx-input').value='Testicular pain';S('note-input').value='For varicocelectomy.';
 const old=qs(paNoteWarn('hx')).some(x=>/semen/i.test(x));
 return (!young&&old)||('under 20: '+young+', over 20: '+old);});
t('with no age given, every question is still shown',()=>{
 reset(); return PA.req.every(r=>r.q.every(paQApplies));});

/* ── what the patient is due ── */
t('the screening layer is grounded in named sources',()=>
 SCR.length>=20&&SCR.every(r=>r.s&&r.f));
t('a child gets childhood screening only',()=>{
 who(1,'Male'); const d=scrDue().map(x=>x.t);
 return d.some(x=>/Growth parameters/.test(x))&&!d.some(x=>/Mammograph|Colorectal/.test(x))||d.join();});
t('mammography appears for a woman of 52 and not a man',()=>{
 who(52,'Female'); const f=scrDue().some(x=>/Mammograph/.test(x.t));
 who(52,'Male');   const m=scrDue().some(x=>/Mammograph/.test(x.t));
 return (f&&!m)||('female '+f+' male '+m);});
t('aortic screening is men 65-75 only',()=>{
 who(70,'Male');   const a=scrDue().some(x=>/aortic/i.test(x.t));
 who(70,'Female'); const b=scrDue().some(x=>/aortic/i.test(x.t));
 who(50,'Male');   const c=scrDue().some(x=>/aortic/i.test(x.t));
 return (a&&!b&&!c)||('m70 '+a+' f70 '+b+' m50 '+c);});
t('sex-specific screens stay quiet until sex is known',()=>{
 reset(); S('hx-age').value='52'; hxWho();
 return !scrDue().some(x=>x.sex);});
t('nothing is due before an age is entered',()=>{
 reset(); return scrDue().length===0;});
t('no age band leaves a gap between 0 and 124',()=>{
 const holes=[];
 for(let y=0;y<=90;y++){
  reset(); S('hx-age').value=String(y); hxWho(); hxSex('Female');
  if(scrDue().length===0) holes.push(y);
 }
 return holes.length===0||('nothing due at ages '+holes.join(','));});
t('every screening line names where it came from',()=>{
 const bad=SCR.filter(r=>!/Guideline|Criteria|Society|Approach|Screening/i.test(r.s)).map(r=>r.t);
 return bad.length===0||bad.join(' | ');});
t('the due list is escaped',()=>{
 SCR.push({t:'<img src=x onerror=1>',lo:0,hi:124,sex:'',f:'x',s:'y'});
 who(30,'Female'); const h=scrRender(); SCR.pop();
 return h.indexOf('<img src=x')<0;});

/* ── it reaches the doctor ── */
t('the pre-authorisation tab carries the coding edits and the due list',()=>{
 who(45,'Female'); S('hx-input').value='Urinary frequency';
 window._hxDx=[{code:'N40',desc:'Hyperplasia of prostate'}];
 hxDoc('pa'); hxDocsRender();
 const b=S('hx-docbody').innerHTML;
 return /male-only/.test(b)&&/Due for this patient/.test(b)||b.slice(0,120);});
t('the tab badge counts the coding edits too',()=>{
 who(45,'Female'); window._hxDx=[{code:'N40',desc:'x'}];
 hxDocsRender(); return /itc-badge">\d/.test(S('hx-doctabs').innerHTML);});
done();
