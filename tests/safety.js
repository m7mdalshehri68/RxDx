/* One safety engine, both modules, and honest about its blind spots. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{rxSafety,rxSafetyHtml,hxSafetyCheck,edAllergyCheck,'+
 'RX_SAFETY_LIMITS,_rxAllergyMap,_rxDrugsIn,_rxDrugAge,_rxDrugSex,hxSex,hxWho,window});');
const {t,done}=runner();

t('a penicillin allergy blocks amoxicillin',()=>{
 const f=rxSafety('penicillin — rash','amoxicillin 500 mg tds');
 return (f.length&&f[0].hard&&/amoxicillin/i.test(f[0].m))||JSON.stringify(f);});
t('an unrelated drug is not flagged',()=>
 rxSafety('penicillin','paracetamol 1 g').filter(x=>x.hard).length===0);
t('NKDA silences the allergy check',()=>
 rxSafety('NKDA','amoxicillin').filter(x=>x.hard).length===0);
t('cross-reactivity is followed, not just the exact word',()=>{
 const f=rxSafety('nsaid allergy','ibuprofen 400 mg');
 return f.some(x=>x.hard)||'ibuprofen was not linked to the NSAID class';});
t('the clinic gets the same engine as the emergency room',()=>{reset();
 S('hx-allergy').value='penicillin';S('hx-plan-rx').value='augmentin 625 mg';
 hxSafetyCheck();
 return /ALLERGY CONFLICT/.test(S('hx-safety').innerHTML)||S('hx-safety').innerHTML.slice(0,120);});
t('emergency still works after being moved onto the shared engine',()=>{reset();
 S('ed-allergy').value='sulfa';S('ed-drugs').value='co-trimoxazole';
 edAllergyCheck();
 return /ALLERGY CONFLICT/.test(S('ed-allergy-warn').innerHTML)&&window._edAllergyClash===true;});
t('the emergency clash flag clears when the clash goes',()=>{reset();
 S('ed-allergy').value='sulfa';S('ed-drugs').value='paracetamol';
 edAllergyCheck();return window._edAllergyClash===false;});

/* the drug against who the patient is */
t('a drug licensed for adults is questioned for a small child',()=>{reset();
 S('hx-age').value='4';S('hx-age-u').value='y';hxWho();
 /* alendronate is 30 y and over in this formulary — a real restriction, not an assumed one */
 const f=rxSafety('','alendronate 70 mg weekly');
 return f.some(x=>x.kind==='age')||'no age question raised';});
t('the same drug is not questioned for an adult',()=>{reset();
 S('hx-age').value='62';S('hx-age-u').value='y';hxWho();
 return rxSafety('','alendronate 70 mg weekly').filter(x=>x.kind==='age').length===0;});
t('the question names the band and the age, so it can be judged',()=>{reset();
 S('hx-age').value='4';S('hx-age-u').value='y';hxWho();
 const f=rxSafety('','alendronate').find(x=>x.kind==='age');
 return (f&&/30 years/.test(f.m)&&/4 years/.test(f.m))||(f?f.m:'nothing');});
t('an age question is a question, never a block',()=>{reset();
 S('hx-age').value='4';S('hx-age-u').value='y';hxWho();
 return rxSafety('','alendronate').filter(x=>x.kind==='age').every(x=>x.hard===false);});
t('a drug approved only for one sex is questioned for the other',()=>{reset();
 hxSex('Female');
 const f=rxSafety('','alfuzosin 10 mg');
 return f.some(x=>x.kind==='sex')||'no sex question raised';});
t('and not questioned for the sex it is approved for',()=>{reset();
 hxSex('Male');
 return rxSafety('','alfuzosin 10 mg').filter(x=>x.kind==='sex').length===0;});
t('nothing is asked when the encounter says nothing about the patient',()=>{reset();
 return rxSafety('','alendronate').filter(x=>x.kind==='age'||x.kind==='sex').length===0;});
t('an allergy clash IS hard, because it can kill',()=>
 rxSafety('penicillin','amoxicillin').filter(x=>x.kind==='allergy').every(x=>x.hard===true));

/* the boundary must be stated */
t('what is not checked is printed with every result',()=>{
 const h=rxSafetyHtml('penicillin','amoxicillin');
 return /drug-drug interactions/.test(h)&&/renal or hepatic/.test(h)&&/pregnancy/.test(h)||h.slice(0,160);});
t('the panel stays silent when nothing was prescribed',()=>rxSafetyHtml('penicillin','')==='');
t('the limits are stated even when nothing was found',()=>{
 const h=rxSafetyHtml('','paracetamol');
 return /Not checked/.test(h)||'the blind spots were hidden when the panel was clean';});
t('the tool never claims to check interactions it cannot see',()=>
 /cannot see them/.test(RX_SAFETY_LIMITS));
t('drug detection needs a real name, not a fragment',()=>
 _rxDrugsIn('the patient is well').length===0);
done();
