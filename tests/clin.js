const H=require('./_harness.js');
const {code}=H.load(); const env=H.makeEnv(); const {S,sel,reset}=env;
const {t,done}=H.runner();
const NAMES=['CLIN','CLIN_SEC','clinFor','clinRender','clinResults','clinCard','flowNode','flowRender','clinHas','clinToggle','HX_DOCS',
 'hxDocsRender','hxDoc','hxDxAdd','PRESENTATIONS','ICD_MAP','PROTO'];
eval(code+'\n;NAMES.forEach(function(n){try{global[n]=eval(n);}catch(_){}});');

/* ── coverage ── */
t('every supplied document is present',()=>CLIN.length===215||('got '+CLIN.length));
t('every document is either summarised or honestly flagged',()=>{
 const bad=CLIN.filter(d=>!clinHas(d)&&!d.img&&!d.thin).map(d=>d.t);
 return bad.length===0||(bad.length+' silent, e.g. '+bad.slice(0,3).join(' | '));});
t('a reviewed summary is never mislabelled',()=>{
 const bad=CLIN.filter(d=>d.v===1&&!clinHas(d)&&!d.img).map(d=>d.t);
 return bad.length===0||bad.join(' | ');});
t('documents read line by line carry real depth',()=>{
 const r=CLIN.filter(d=>d.v===1);
 const thin=r.filter(d=>CLIN_SEC.reduce((n,s)=>n+(d[s[0]]||[]).length,0)<4&&!d.img).map(d=>d.t);
 return (r.length>=10&&thin.length===0)||('reviewed '+r.length+', thin: '+thin.join(' | '));});
t('every entry names its source file',()=>CLIN.every(d=>/\.pdf$/.test(d.s||'')));
t('every entry has a title and a folder',()=>CLIN.every(d=>d.t&&d.f));
t('most are linked to an ICD block',()=>{const n=CLIN.filter(d=>d.px&&d.px.length).length;
 return n>=155||('only '+n);});
t('no line welds two clauses together',()=>{
 const bad=[];CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{
  if(/[a-z]{4} [A-Z][a-z]{4,} [A-Z][a-z]{4,}/.test(x))bad.push(d.t+' · '+x.slice(0,60));})));
 return bad.length===0||(bad.length+' welded, e.g. '+bad.slice(0,2).join(' | '));});
t('no word is cut across a column break',()=>{
 const STEM=/\b(acteristic|ecommend|ollowing|reatment|iagnosis|atient|linical|anagement)\b/i,bad=[];
 CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{if(STEM.test(x))bad.push(d.t+' · '+x.slice(0,60));})));
 return bad.length===0||(bad.length+' cut words, e.g. '+bad.slice(0,2).join(' | '));});
t('no journal or author metadata',()=>{
 const BAD=/\bMD\b,|\bPhD\b|FACC|FAHA|downloaded from|ahajournals|writing committee|pubmed|embase/i,bad=[];
 CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{if(BAD.test(x))bad.push(d.t+' · '+x.slice(0,60));})));
 return bad.length===0||(bad.length+' e.g. '+bad.slice(0,2).join(' | '));});
t('every linked code exists',()=>{const bad=CLIN.filter(d=>d.c&&!ICD_MAP[String(d.c).toUpperCase()]);
 return bad.length===0||('invalid: '+bad.slice(0,3).map(d=>d.c));});

/* ── content quality — the thing that kept failing ── */
t('no citation or reference junk survived',()=>{
 const BAD=/\b(19|20)\d{2}\b|et al\b|aafp|available at|https?:|doi:|appendix|task force/i,bad=[];
 CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{if(BAD.test(x))bad.push(d.t+' · '+x.slice(0,60));})));
 return bad.length===0||(bad.length+' junk items, e.g. '+bad.slice(0,3).join(' | '));});
t('no line ends mid-sentence',()=>{
 const TAIL=new Set(['the','a','an','and','or','of','with','in','to','for','is','are','by','from','on','at','than','as']);
 const bad=[];
 CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{
  const w=x.split(' ');if(TAIL.has(w[w.length-1].toLowerCase().replace(/[.,;:]/g,'')))bad.push(d.t+' · '+x.slice(-40));})));
 return bad.length===0||(bad.length+' fragments, e.g. '+bad.slice(0,3).join(' | '));});
t('no line starts lower-case',()=>{
 const bad=[];CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{
  if(/^[a-z]/.test(x))bad.push(d.t+' · '+x.slice(0,50));})));
 return bad.length===0||(bad.length+' e.g. '+bad.slice(0,2).join(' | '));});
t('no line is a table of contents row',()=>{
 const bad=[];CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{
  if((x.match(/\./g)||[]).length>6)bad.push(d.t);})));
 return bad.length===0||('dotted rows in: '+[...new Set(bad)].slice(0,3));});
t('every summary line is a real sentence',()=>{
 const bad=[];CLIN.filter(z=>z.v!==1).forEach(d=>CLIN_SEC.forEach(s=>(d[s[0]]||[]).forEach(x=>{
  if(x.split(' ').length<4||x.length<18)bad.push(d.t+' · '+x);})));
 return bad.length===0||(bad.length+' too short, e.g. '+bad.slice(0,3).join(' | '));});

/* ── the documents the user pointed at ── */
t('the chest pain documents are summarised',()=>{
 const d=CLIN.filter(x=>/chest pain/i.test(x.t));
 return d.length>=2&&d.some(clinHas)||('found '+d.length+', summarised '+d.filter(clinHas).length);});
t('the headache documents are summarised',()=>{
 const d=CLIN.filter(x=>/headache|migraine/i.test(x.t));
 return d.length>=3&&d.filter(clinHas).length>=2||('found '+d.length+', summarised '+d.filter(clinHas).length);});

/* ── behaviour ── */
t('a coded patient gets their documents first',()=>{reset();
 hxDxAdd('E11.9');const r=clinFor('',['E11.9']);
 return r.length>0&&r.some(d=>/diabet/i.test(d.t));});
t('a complaint matches too',()=>clinFor('Chest pain',[]).length>0);
t('nothing matched returns empty, never wrong',()=>clinFor('zzz',['ZZZ.9']).length===0);
t('the reference renders with a search box',()=>{reset();clinRender('hx-clin-out','hx');
 return /Search all 215 national documents/.test(S('hx-clin-out').innerHTML)
   &&/clin-card/.test(S('hx-clin-out-res').innerHTML);});
t('it groups the library by folder',()=>{reset();clinRender('hx-clin-out','hx');
 return /clin-grp/.test(S('hx-clin-out-res').innerHTML);});
t('search narrows the list',()=>{reset();clinRender('hx-clin-out','hx');
 S('hx-clin-out-q').value='migraine';clinResults('hx-clin-out','hx');
 const b=S('hx-clin-out-res').innerHTML;
 return /match/.test(b)&&/Migraine/i.test(b);});
t('a search with no hits says so',()=>{reset();clinRender('hx-clin-out','hx');
 S('hx-clin-out-q').value='zzzqqq';clinResults('hx-clin-out','hx');
 return /Nothing matches that search/.test(S('hx-clin-out-res').innerHTML);});
t('every card cites its file',()=>{reset();clinRender('hx-clin-out','hx');
 const b=S('hx-clin-out-res').innerHTML;
 return (b.match(/clin-card/g)||[]).length===(b.match(/Source:/g)||[]).length;});
t('hostile content is escaped',()=>{reset();
 CLIN.push({t:'<img src=x onerror=1>',s:'x.pdf',f:'T',when:['<script>bad</script> a real sentence here']});
 clinRender('hx-clin-out','hx');const b=S('hx-clin-out-res').innerHTML;CLIN.pop();
 return b.indexOf('<img src=x')<0&&b.indexOf('<script>bad')<0;});
t('it has its own place in the sidebar',()=>{const {html}=require('./_harness.js').load();
 return /\["Reference",\["clin"(,"preauth")?\]\]/.test(html)&&/id="panel-clin"/.test(html);});
t('the sidebar entry is named Clinical indications',()=>{const {html}=require('./_harness.js').load();
 return /clin:"Clinical indications"/.test(html);});

/* ── the search box has to actually search ── */
t('the search field is drawn once, so typing keeps the caret',()=>{
 reset();clinRender('clin-out','hx');
 const first=S('clin-out').innerHTML;
 S('clin-out-q').value='asthma';clinResults('clin-out','hx');
 return S('clin-out').innerHTML===first;});
t('a search narrows the library',()=>{
 reset();clinRender('clin-out','hx');
 S('clin-out-q').value='';clinResults('clin-out','hx');
 const all=(S('clin-out-res').innerHTML.match(/clin-card/g)||[]).length;
 S('clin-out-q').value='asthma';clinResults('clin-out','hx');
 const few=(S('clin-out-res').innerHTML.match(/clin-card/g)||[]).length;
 return (few>0&&few<all)||('all '+all+' vs '+few);});
t('every search word must match',()=>{
 reset();clinRender('clin-out','hx');
 S('clin-out-q').value='asthma zzzzz';clinResults('clin-out','hx');
 return /Nothing matches/.test(S('clin-out-res').innerHTML);});
t('search finds words inside the guidance, not just titles',()=>{
 reset();clinRender('clin-out','hx');
 const word=(CLIN.find(d=>d.when&&d.when.length)||{when:['']}).when[0].split(/\s+/)
   .find(w=>w.length>7&&/^[a-z]+$/i.test(w))||'patients';
 S('clin-out-q').value=word;clinResults('clin-out','hx');
 return (S('clin-out-res').innerHTML.match(/clin-card/g)||[]).length>0||('no hit for '+word);});
t('clearing the search brings the whole library back',()=>{
 reset();clinRender('clin-out','hx');
 S('clin-out-q').value='asthma';clinResults('clin-out','hx');
 S('clin-out-q').value='';clinResults('clin-out','hx');
 return (S('clin-out-res').innerHTML.match(/clin-card/g)||[]).length===CLIN.length;});
t('every card still names its source file',()=>{
 reset();clinRender('clin-out','hx');
 const n=(S('clin-out-res').innerHTML.match(/Source:/g)||[]).length;
 return n===CLIN.length||('only '+n+' of '+CLIN.length);});


/* ── documents that are flowcharts are shown as flowcharts ── */
t('a decision tree renders every branch',()=>{
 const vd=CLIN.find(d=>/Vitamin D/.test(d.t));
 if(!vd||!vd.flow)return 'vitamin D has no decision tree';
 const h=flowRender(vd);
 const count=n=>n?('r' in n?1:count(n.y)+count(n.n)):0;
 const ends=(h.match(/flow-end/g)||[]).length;
 return ends===count(vd.flow)||('rendered '+ends+' of '+count(vd.flow)+' outcomes');});
t('yes and no branches are both labelled',()=>{
 const vd=CLIN.find(d=>d.flow);const h=flowRender(vd);
 return /flow-edge y/.test(h)&&/flow-edge n/.test(h);});
t('a justified outcome is green and a refused one is red',()=>{
 const vd=CLIN.find(d=>d.flow);const h=flowRender(vd);
 return /flow-end ok/.test(h)&&/flow-end no/.test(h);});
t('the tree is escaped like everything else',()=>{
 const h=flowNode({q:'<img src=x onerror=1>',y:{r:'<script>bad</script>'},n:{r:'ok'}},0,'');
 return h.indexOf('<img src=x')<0&&h.indexOf('<script>bad')<0;});
t('a flowchart document is not called unsummarised',()=>{
 const bad=CLIN.filter(d=>d.flow&&d.thin).map(d=>d.t);
 return bad.length===0||bad.join(' | ');});
t('the card shows the tree',()=>{
 const vd=CLIN.find(d=>d.flow);
 return /Decision pathway/.test(clinCard(vd,true));});
done();
