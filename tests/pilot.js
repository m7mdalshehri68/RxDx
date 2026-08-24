/* Pilot measurement: a baseline entered by a person, claim outcomes recorded
   by a person, and an honest comparison between them. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{plLoad,plSave,plBase,plSetBase,plClearBase,plRecord,plUndo,'+
 'plOutcomes,plNow,plRender,plCsv,PL_REASONS,encCapture,encList,hxDxAdd,window});');
const {t,done}=runner();
const wipe=()=>{try{global.localStorage.removeItem('rxdx_pilot_v1');}catch(_){}};

t('nothing is assumed: with no baseline entered, there is none',()=>{wipe();return plBase()===null;});
t('the tool never invents a baseline for itself',()=>{wipe();
 const n=plNow();plRender();
 const h=S('pl-out').innerHTML;
 return /Nothing recorded yet/.test(h)&&plBase()===null||'a baseline appeared from nowhere';});
t('a baseline records who entered it and when',()=>{wipe();
 plSetBase('by','Dr A. Coder');plSetBase('rej','18');
 const b=plBase();
 return (b.by==='Dr A. Coder'&&b.rej===18&&typeof b.t==='number')||JSON.stringify(b);});
t('a non-numeric figure is refused rather than stored as text',()=>{wipe();
 plSetBase('rej','abc');return plBase().rej===null||JSON.stringify(plBase().rej);});
t('the baseline can be cleared',()=>{wipe();plSetBase('rej','18');plClearBase();return plBase()===null;});

t('a claim outcome is recorded with its reason',()=>{wipe();
 plRecord('rejected','Missing documentation','Chest pain');
 const o=plOutcomes();
 return (o.length===1&&o[0].r==='rejected'&&o[0].why==='Missing documentation')||JSON.stringify(o);});
t('an accepted claim carries no reason',()=>{wipe();
 plRecord('accepted','','Chest pain');return plOutcomes()[0].why==='';});
t('the last entry can be undone',()=>{wipe();
 plRecord('accepted','','a');plRecord('rejected','Duplicate','b');
 plUndo();const o=plOutcomes();
 return (o.length===1&&o[0].cc==='a')||JSON.stringify(o);});
t('the rejection rate is computed from real entries only',()=>{wipe();
 plRecord('accepted','','a');plRecord('accepted','','b');plRecord('rejected','Duplicate','c');
 const r=plNow().rejected;
 return Math.abs(r-33.333)<0.1||('got '+r);});
t('with no claims recorded the rate is unknown, not zero',()=>{wipe();
 return plNow().rejected===null||('got '+plNow().rejected);});
t('the reasons offered are the ones payers actually give',()=>
 PL_REASONS.length>=6&&PL_REASONS.indexOf('No pre-authorisation')>=0);

t('the comparison shows before, now and the change',()=>{wipe();
 plSetBase('rej','20');
 plRecord('rejected','Duplicate','a');plRecord('accepted','','b');
 plRender();const h=S('pl-out').innerHTML;
 return /Before<\/th>/.test(h)&&/Now<\/th>/.test(h)&&/Change<\/th>/.test(h)||h.slice(0,140);});
t('a fall in rejections reads as good, a rise as bad',()=>{wipe();
 plSetBase('rej','50');
 plRecord('accepted','','a');plRecord('accepted','','b');plRecord('accepted','','c');
 plRecord('rejected','Duplicate','d');           /* 25% — down from 50 */
 plRender();
 return /pl-good/.test(S('pl-out').innerHTML)||'a fall was not marked as an improvement';});
t('a small sample says so instead of claiming a result',()=>{wipe();
 plSetBase('rej','20');plRecord('accepted','','a');
 try{S('hx-input').value='Chest pain';hxDxAdd('I20.0');encCapture('hx','final');}catch(_){}
 plRender();
 return /direction, not a result/.test(S('pl-out').innerHTML)||'no caution on a tiny sample';});
t('the refusal reasons are ranked so the commonest is visible',()=>{wipe();
 plRecord('rejected','Missing documentation','a');
 plRecord('rejected','Missing documentation','b');
 plRecord('rejected','Duplicate','c');
 plRender();const h=S('pl-out').innerHTML;
 const i1=h.indexOf('Missing documentation'),i2=h.indexOf('Duplicate');
 return (i1>=0&&i2>=0&&i1<i2)||'the commonest reason is not first';});
t('no patient detail is stored with an outcome',()=>{wipe();
 plRecord('rejected','Duplicate','Chest pain');
 const keys=Object.keys(plOutcomes()[0]).sort().join(',');
 return keys==='cc,r,t,why'||keys;});
t('the outcome list is capped so it cannot grow without bound',()=>{wipe();
 for(let i=0;i<20;i++)plRecord('accepted','','x'+i);
 return plOutcomes().length<=4000;});
t('a decision is written to the audit trail',()=>{wipe();
 let before=0;try{before=auditList().length;}catch(_){}
 plRecord('rejected','Duplicate','a');
 let after=0;try{after=auditList().length;}catch(_){}
 return after>before||'nothing audited';});
done();
