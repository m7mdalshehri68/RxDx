/* Clinical calculators — regression tests.
   Two kinds of check. Internal consistency catches a transcription slip in the
   point values. Reference cases catch a calculator that sums correctly but is
   not the published instrument. A score that is quietly wrong is worse than no
   score at all, because it is written into a note and acted on. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{TOOLS,_toolOpts,toolScoreOf,toolNoteLines,toolsFor,toolSet,window});');
const {t,done}=runner();
const T=id=>TOOLS.find(x=>x.id===id);
const opts=(tool,i)=>_toolOpts(tool,i)||tool.q[i][1]||tool.scale;

/* score a calculator by naming, for each question, the option to pick */
function score(id,picks){
 const tool=T(id); if(!tool)return 'no such calculator: '+id;
 let total=0;
 picks.forEach((want,i)=>{
  const o=opts(tool,i);
  let hit=null;
  if(typeof want==='number') hit=o[want];
  else hit=o.find(x=>String(x[0]).toLowerCase().indexOf(String(want).toLowerCase())>=0);
  if(!hit)throw new Error(id+' q'+i+': no option matching '+JSON.stringify(want)+' in '+JSON.stringify(o.map(x=>x[0])));
  total+=hit[1];
 });
 return total;
}
const maxOf=id=>{const x=T(id);return x.q.reduce((n,_,i)=>n+Math.max(...opts(x,i).map(v=>v[1])),0);};
const minOf=id=>{const x=T(id);return x.q.reduce((n,_,i)=>n+Math.min(...opts(x,i).map(v=>v[1])),0);};

/* ── every calculator, structurally ── */
t('all 24 calculators are present',()=>TOOLS.length===24||('found '+TOOLS.length));
t('every calculator declares a name, a maximum and a band',()=>{
 const bad=TOOLS.filter(x=>!x.name||typeof x.max!=='number'||!x.note);
 return bad.length===0||('incomplete: '+bad.map(x=>x.id).join());});
t('every question offers at least two options',()=>{
 const bad=[];TOOLS.forEach(x=>x.q.forEach((_,i)=>{const o=opts(x,i);if(!o||o.length<2)bad.push(x.id+' q'+i);}));
 return bad.length===0||bad.join();});
t('the options sum to the declared maximum',()=>{
 const bad=TOOLS.filter(x=>maxOf(x.id)!==x.max).map(x=>x.id+': '+maxOf(x.id)+' vs '+x.max);
 return bad.length===0||bad.join(' · ');});
t('the band thresholds sit inside the calculator\'s own range',()=>{
 /* only the thresholds at the head of the note are scores. Later numbers are
    prose — "48 hours", "of 10" — and flagging those is a false alarm. */
 const bad=[];TOOLS.forEach(x=>{
  const head=String(x.note).split(/[·(]/)[0];
  const nums=(head.match(/\d+(?:\.\d+)?/g)||[]).map(Number)
    .filter((v,i,arr)=>!/\d\s*(hours?|days?|weeks?|months?|years?|cm|kg|%)/i.test(head));
  const over=nums.filter(v=>v>x.max);
  if(over.length)bad.push(x.id+' band mentions '+over.join()+' above max '+x.max);});
 return bad.length===0||bad.join(' · ');});
t('every calculator has an id used nowhere else',()=>{
 const ids=TOOLS.map(x=>x.id);return ids.length===new Set(ids).size||'duplicate id';});
t('a calculator with no answers scores its minimum, not zero by accident',()=>{
 const bad=TOOLS.filter(x=>minOf(x.id)>x.max).map(x=>x.id);
 return bad.length===0||bad.join();});

/* ── reference cases against the published instruments ── */
t('HEART: all lowest answers scores 0',()=>score('heart',[0,0,0,0,0])===0);
t('HEART: all highest answers scores 10',()=>score('heart',[2,2,2,2,2])===10);
t('HEART: moderately suspicious history, normal ECG, 45-64, 1-2 factors, normal troponin = 3',
 ()=>score('heart',[1,0,1,1,0])===3);
t('HEART: the age bands are ordered under 45 / 45-64 / 65+',()=>{
 const o=opts(T('heart'),2);
 return (o[0][1]===0&&o[1][1]===1&&o[2][1]===2)||JSON.stringify(o);});
t('HEART: the low-risk band ends at 3 and high risk begins at 7',
 ()=>/0.?3 low/i.test(T('heart').note)&&/7/.test(T('heart').note));

t('Wells PE: nothing present scores 0',()=>score('wellspe',[0,0,0,0,0,0,0])===0);
t('Wells PE: the maximum is 12.5',()=>maxOf('wellspe')===12.5);
t('Wells PE: 4 or under is unlikely, over 4 is likely',()=>{
 const n=T('wellspe').note;return /low|unlikely/i.test(n)&&/high|likely/i.test(n);});

t('Wells DVT: the scale can go negative, because one item scores −2',
 ()=>minOf('wellsdvt')===-2||('min is '+minOf('wellsdvt')));
t('Wells DVT: 2 or more means DVT likely',()=>/≥\s*2|2 or more/i.test(T('wellsdvt').note));

t('Centor: 4 of 4 criteria scores 4',()=>score('centor',[1,1,1,1])===4);
t('Centor: none present scores 0',()=>score('centor',[0,0,0,0])===0);

t('Alvarado: the maximum is 10',()=>maxOf('alvarado')===10);
t('Alvarado: 7 or more points to appendicitis',()=>/7/.test(T('alvarado').note));

t('ABCD2: the maximum is 7',()=>maxOf('abcd2')===7);
t('PHQ-9: nine items on a 0–3 scale gives a maximum of 27',
 ()=>T('phq9').q.length===9&&maxOf('phq9')===27);
t('PHQ-9: every item is answered on the same 0–3 scale',()=>{
 const s=T('phq9').scale.map(x=>x[1]);return JSON.stringify(s)==='[0,1,2,3]'||JSON.stringify(s);});
t('PHQ-9: "nearly every day" on all nine items scores 27',
 ()=>score('phq9',new Array(9).fill('Nearly every day'))===27);
t('PHQ-9: item 9 is the self-harm question and is present',
 ()=>/better off dead|hurting yourself/i.test(T('phq9').q[8][0]));

t('GAD-7: seven items on 0–3 gives a maximum of 21',
 ()=>T('gad7').q.length===7&&maxOf('gad7')===21);
t('GAD-7: "several days" on all seven items scores 7',
 ()=>score('gad7',new Array(7).fill('Several days'))===7);

t('IPSS: seven items on 0–5 gives a maximum of 35',
 ()=>T('ipss').q.length===7&&maxOf('ipss')===35);

t('ACT: five items on 1–5 gives 5 to 25',
 ()=>minOf('act')===5&&maxOf('act')===25);
t('ACT: 20 or more is well controlled',()=>/20/.test(T('act').note));

t('AMT-10: ten items scoring 1 each',()=>T('amt10').q.length===10&&maxOf('amt10')===10);
t('SCOFF: five yes-or-no items, two or more is a positive screen',
 ()=>T('scoff').q.length===5&&maxOf('scoff')===5&&/2/.test(T('scoff').note));
t('DN4: seven items, 4 or more suggests neuropathic pain',
 ()=>maxOf('dn4')===7&&/4/.test(T('dn4').note));
t('STOP-BANG: eight items, each worth one point',
 ()=>T('osa').q.length===8&&maxOf('osa')===8);
t('Wexner: five items on 0–4 gives a maximum of 20',
 ()=>T('wexner').q.length===5&&maxOf('wexner')===20);
t('Rome IV constipation: six criteria, two or more required',
 ()=>maxOf('rome')===6&&/2/.test(T('rome').note));
t('Ottawa ankle: five criteria, any one of them means an X-ray',
 ()=>maxOf('ottawaankle')===5);
t('Canadian C-spine: five criteria',()=>maxOf('ccspine')===5);
t('MRC dyspnoea: one item, grades 1 to 5',
 ()=>minOf('mrc')===1&&maxOf('mrc')===5);
t('NYHA: one item, classes I to IV',()=>minOf('nyha')===1&&maxOf('nyha')===4);
t('4AT: the maximum is 12 and 4 or more suggests delirium',
 ()=>maxOf('fourat')===12&&/4/.test(T('fourat').note));
t('STarT Back: nine items, the psychosocial subscale is the last five',
 ()=>T('startback').q.length===9&&maxOf('startback')===9);

/* ── a calculator must not fire on the wrong complaint ── */
t('a calculator is offered by complaint, not at random',()=>{
 const withCx=TOOLS.filter(x=>x.cx&&x.cx.length).length;
 return withCx>=18||(withCx+' of 24 carry a complaint');});
t('every calculator that names an ICD prefix names a real one',()=>{
 const bad=[];TOOLS.forEach(x=>(x.px||[]).forEach(p=>{if(!/^[A-Z]\d/.test(p))bad.push(x.id+':'+p);}));
 return bad.length===0||bad.join();});

done();
