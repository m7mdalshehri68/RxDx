/* The specificity prompt, discharge coding, the refusal→vocabulary loop, and
   teaching mode. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{specBetter,specRender,specSwap,specDismiss,dcAnalyse,dcText,'+
 'vocabQueue,vocabQueueHtml,teachOn,teachSet,teachWhy,plRecord,plOutcomes,hxDxAdd,_stProblems,window});');
const {t,done}=runner();
const wipePilot=()=>{try{global.localStorage.removeItem('rxdx_pilot_v1');}catch(_){}};

/* ── the specificity prompt ── */
t('an unspecified code is questioned when the note earns better',()=>{reset();
 S('hx-input').value='Chronic kidney disease';
 S('hx-out').value='Impression: chronic kidney disease stage 3b, likely diabetic.';
 const b=specBetter('N18.9');
 return (b&&b.code==='N18.3')||JSON.stringify(b);});
t('it is not raised when the note gives no more detail',()=>{reset();
 S('hx-out').value='Impression: chronic kidney disease.';
 return specBetter('N18.9')===null;});
t('a code that is already specific is never questioned',()=>{reset();
 S('hx-out').value='Impression: chronic kidney disease stage 3b.';
 return specBetter('N18.3')===null;});
t('the prompt names the wording that earned the better code',()=>{reset();
 S('hx-out').value='Impression: chronic kidney disease stage 3b.';
 const b=specBetter('N18.9');
 return (b&&/stage 3/.test(b.term))||JSON.stringify(b);});
t('a denied detail does not earn a more specific code',()=>{reset();
 S('hx-out').value='Impression: chronic kidney disease. No stage 3 disease.';
 const b=specBetter('N18.9');
 return b===null||('wrongly suggested '+JSON.stringify(b));});
t('accepting the suggestion swaps the code, it does not add a second one',()=>{reset();
 S('hx-out').value='Impression: chronic kidney disease stage 3b.';
 hxDxAdd('N18.9');specSwap('N18.9','N18.3');
 const c=(window._hxDx||[]).map(x=>x.code);
 return (c.includes('N18.3')&&!c.includes('N18.9'))||c.join();});
t('keeping the original silences it for that code only',()=>{reset();
 window._specOff=null;specDismiss('N18.9');
 return window._specOff&&window._specOff['N18.9']===1;});

/* ── discharge coding ── */
t('the discharge summary is coded from every field, not just the diagnosis',()=>{reset();
 S('dc-adm').value='Community acquired pneumonia';
 S('dc-course').value='Developed acute kidney injury on day 3, treated with fluids';
 S('dc-dx').value='Pneumonia, acute kidney injury';
 dcAnalyse();
 const h=S('dc-out').innerHTML;
 return (/J18/.test(h)&&/N17/.test(h))||h.slice(0,200);});
t('it names what the stay added that admission did not',()=>{reset();
 S('dc-adm').value='Community acquired pneumonia';
 S('dc-course').value='Developed acute kidney injury during the stay';
 S('dc-dx').value='Pneumonia and acute kidney injury';
 dcAnalyse();
 return /not in the admission diagnosis/.test(S('dc-out').innerHTML)||'the new diagnosis was not highlighted';});
t('an empty summary says so rather than showing nothing',()=>{reset();
 dcAnalyse();return /Fill the summary/.test(S('dc-out').innerHTML);});
t('the discharge coder uses the same negation rule',()=>{reset();
 S('dc-course').value='No acute kidney injury during the stay.';
 S('dc-dx').value='Community acquired pneumonia';
 dcAnalyse();
 return !/N17/.test(S('dc-out').innerHTML)||'a denied complication was coded';});

/* ── refusals feed the vocabulary ── */
t('with no refusals recorded the queue says so',()=>{wipePilot();
 return /No refusals recorded yet/.test(vocabQueueHtml());});
t('a refused complaint appears in the queue',()=>{wipePilot();
 plRecord('rejected','Missing documentation','chest pain');
 const q=vocabQueue();
 return (q.length===1&&q[0].cc==='chest pain')||JSON.stringify(q);});
t('a complaint the tool cannot even name is ranked first',()=>{wipePilot();
 plRecord('rejected','Unspecified diagnosis','chest pain');
 plRecord('rejected','Missing documentation','zzz unknown complaint');
 const q=vocabQueue();
 return (q[0].reach===false)||q.map(x=>x.cc+':'+x.reach).join();});
t('the queue counts how often each was refused',()=>{wipePilot();
 plRecord('rejected','Duplicate','chest pain');
 plRecord('rejected','Duplicate','chest pain');
 return vocabQueue()[0].n===2||JSON.stringify(vocabQueue());});
t('accepted claims are not treated as gaps',()=>{wipePilot();
 plRecord('accepted','','chest pain');
 return vocabQueue().length===0;});
t('the queue says plainly which ones have no wording',()=>{wipePilot();
 plRecord('rejected','Other','zzz unknown complaint');
 return /no wording for this/.test(vocabQueueHtml());});

/* ── teaching mode ── */
t('teaching is off unless it is turned on',()=>{teachSet(false);return teachOn()===false;});
t('with it off, nothing extra is shown',()=>{teachSet(false);
 return teachWhy({named:true,symptom:false,principal:true},true)==='';});
t('a demoted symptom is explained, not just demoted',()=>{teachSet(true);
 const h=teachWhy({symptom:true,principal:false},true);
 teachSet(false);
 return /commonest avoidable refusal/.test(h)||h;});
t('an unspecified code explains what it costs',()=>{teachSet(true);
 const h=teachWhy({vague:4,principal:true},true);teachSet(false);
 return /higher rate/.test(h)||h;});
t('a code matched from an abbreviation warns about it',()=>{teachSet(true);
 const h=teachWhy({term:'HTN',principal:true},true);teachSet(false);
 return /wrong code/.test(h)||h;});
t('a symptom with no diagnosis is explained as correct, not wrong',()=>{teachSet(true);
 const h=teachWhy({symptom:true,principal:true},false);teachSet(false);
 return /undifferentiated presentation/.test(h)||h;});
done();
