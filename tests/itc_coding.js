/* Control Centre → Clinical content → coding: codes switched off and the
   hospital's default codes for unqualified phrases. Both are read by the engine
   itself, so the tool and the coding service answer the same way. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();makeEnv();
eval(code+';Object.assign(global,{_stProblems,_buildNoteIndexes,itcLoad,itcSaveRaw,itcDefaultsParse,_itcCoding,ICD_MAP});');
const {t,done}=runner();
const codes=note=>_stProblems(note,' '+note.toLowerCase().replace(/\s+/g,' ')+' ').map(x=>x.code).sort();
const setCfg=o=>{const c=itcLoad();Object.assign(c,o);if(o.off)c.off=Object.assign(itcLoad().off,o.off);itcSaveRaw(c);};
const NOTE='Obesity, BMI 41. Impression: peptic ulcer.';
const base=codes(NOTE);

t('with nothing configured the engine answers exactly as measured',()=>{
  const c=_itcCoding();
  return (!Object.keys(c.off).length&&!Object.keys(c.def).length&&base.join()==='E66.90,K27.3,U78.1')||base.join();
});
t('a code switched off is never suggested',()=>{
  setCfg({off:{icd:['U78.1']}});
  const r=codes(NOTE);
  return (r.indexOf('U78.1')<0&&r.indexOf('E66.90')>=0)||r.join();
});
t('a switched-off code that is not in the table is ignored, not invented',()=>{
  setCfg({off:{icd:['U78.1','I50.21']}});
  return !_itcCoding().off['I50.21']||'I50.21 accepted';
});
t('a hospital default owns its exact phrase',()=>{
  setCfg({defaults:[{p:'peptic ulcer',c:'K27.9',n:''}]});
  const r=codes(NOTE);
  return (r.indexOf('K27.9')>=0&&r.indexOf('K27.3')<0)||r.join();
});
t('a default adds a phrase the vocabulary did not have',()=>{
  setCfg({defaults:[{p:'diabetes',c:'E11.9',n:'type 2 unless stated'}]});
  return codes('Impression: diabetes.').join()==='E11.9'||codes('Impression: diabetes.').join();
});
t('a default goes through the same negation checks',()=>{
  const r=codes('No diabetes. Impression: viral upper respiratory tract infection.');
  return r.indexOf('E11.9')<0||r.join();
});
t('a default pointing at a code outside the table is refused',()=>{
  const p=itcDefaultsParse('phrase,code,note\nheart failure,I50.21,\nhypertension,I10,essential');
  return (p.ok.length===1&&p.ok[0].c==='I10'&&p.bad.length===1&&/I50\.21/.test(p.bad[0]))||JSON.stringify(p);
});
t('a quoted note with a comma survives the CSV',()=>{
  const p=itcDefaultsParse('diabetes,E11.9,"type 2, unless stated"');
  return p.ok[0].n==='type 2, unless stated'||JSON.stringify(p);
});
t('clearing the configuration restores the measured answer',()=>{
  setCfg({off:{icd:[]},defaults:[]});
  return codes(NOTE).join()===base.join()||codes(NOTE).join();
});
done();
