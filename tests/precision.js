/* ══════════════════════════════════════════════════════════════════════
   PRECISION — the codes the tool must NOT return

   A missed code costs money. A wrong code costs money AND puts a disease the
   patient does not have on their permanent record, which is the failure a
   medical director will look for in the first five minutes of a demonstration.

   Every case below was found by measuring against the labelled corpus, and
   every one of them was a real defect in the engine, not a bad label.
   ══════════════════════════════════════════════════════════════════════ */
const {load,makeEnv}=require('./_harness.js');
const {code}=load();makeEnv();
eval(code+';Object.assign(global,{_stProblems,_stIsSymptom,_stImpression,_stCollapse,'+
 'ST_SYMPTOM_CODE,ICD_MAP,window});');
const {runner}=require('./_harness.js');
const {t,done}=runner();

const run=n=>_stProblems(n,' '+n.toLowerCase().replace(/\s+/g,' ')+' ');
const pri=n=>run(n).filter(x=>x.principal!==false).map(x=>x.code);
const sup=n=>run(n).filter(x=>x.principal===false).map(x=>x.code);
const all=n=>run(n).map(x=>x.code);

/* ══════════ 1 · the symptom the diagnosis already explains ══════════
   Testicular torsion AND testicular pain on the same claim is a coder who
   could not decide which one it was. */

const TORSION='24 y male with sudden severe left testicular pain and vomiting for 3 hours. '
 +'Left testis high riding with absent cremasteric reflex. Impression: testicular torsion. '
 +'Immediate surgical exploration.';
t('torsion is the diagnosis',()=>pri(TORSION).some(c=>/^N44/.test(c))||'got '+pri(TORSION));
t('testicular pain is not a second diagnosis',()=>
 !pri(TORSION).some(c=>/^N50/.test(c))||'N50.8 was returned as principal');
t('testicular pain is still recorded, as a supporting finding',()=>
 sup(TORSION).some(c=>/^N50/.test(c))||'the pain was dropped instead of demoted');

const HYPO='43 y female with tiredness, cold intolerance, constipation and 6 kg weight gain. '
 +'TSH 14.2, free T4 low. Impression: primary hypothyroidism. Started levothyroxine.';
t('hypothyroidism is the diagnosis',()=>pri(HYPO).some(c=>/^E03/.test(c))||'got '+pri(HYPO));
t('constipation is not coded as a second diagnosis',()=>
 !pri(HYPO).includes('K59.0')||'K59.0 was returned as principal');

const WHIPLASH='44 y male after a road traffic collision. Neck pain, no midline tenderness, '
 +'fully alert. Canadian C-spine rule: no imaging indicated. Impression: whiplash-associated neck sprain.';
t('the neck sprain is the diagnosis',()=>pri(WHIPLASH).some(c=>/^S13/.test(c))||'got '+pri(WHIPLASH));
t('neck pain is not coded beside the sprain that causes it',()=>
 !pri(WHIPLASH).includes('M54.2')||'M54.2 was returned as principal');

const MENO='49 y female with hot flushes, night sweats and irregular periods for 8 months. '
 +'FSH raised. Impression: perimenopausal symptoms.';
t('perimenopausal symptoms is the diagnosis',()=>pri(MENO).some(c=>/^N95/.test(c))||'got '+pri(MENO));
t('irregular periods is not a second diagnosis',()=>
 !pri(MENO).includes('N92.6')||'N92.6 was returned as principal');

/* the rule is relative, not absolute — a complaint with nothing behind it is
   still the diagnosis */
t('back pain alone is still a principal diagnosis',()=>{
 const p=pri('38 y male with low back pain for 3 weeks. No red flags. No trauma. Neurologically intact.');
 return p.includes('M54.5')||'got '+p;});
t('constipation alone is still a principal diagnosis',()=>{
 const p=pri('61 y female with constipation for 2 months. No bleeding, no weight loss.');
 return p.includes('K59.0')||'got '+p;});

t('the symptom list is explicit, not guessed',()=>
 (ST_SYMPTOM_CODE&&Object.keys(ST_SYMPTOM_CODE).length>=20)||'the list is missing or too short');
t('chapter R is still treated as symptoms',()=>_stIsSymptom('R50.9')===true);
t('a real diagnosis is never on the symptom list',()=>{
 const wrong=['I60.9','I64','J81','K29.70','A38','G93.6']
  .filter(c=>ST_SYMPTOM_CODE[c]);
 return wrong.length===0||'these diagnoses were listed as symptoms: '+wrong.join();});

/* ══════════ 2 · one phrase, one code ══════════ */

const DKA='61 y male, known type 2 diabetes and hypertension, brought with reduced consciousness. '
 +'Glucose 31, ketones 4.2, pH 7.18. Impression: diabetic ketoacidosis. IV fluids and insulin started.';
t('the ketoacidosis is coded',()=>pri(DKA).some(c=>/^E1[0-4]/.test(c))||'got '+pri(DKA));
t('it is coded once, not once per diabetes type',()=>{
 const dm=pri(DKA).filter(c=>/^E1[0-4]/.test(c));
 return dm.length===1||'got '+dm.join()+' — the same diagnosis twice';});
t('the specified type wins over the unspecified one',()=>{
 const dm=pri(DKA).filter(c=>/^E1[0-4]/.test(c));
 return !dm.some(c=>/^E14/.test(c))||'kept the unspecified-type code '+dm.join();});

/* the narrowness of that rule matters: these two share a phrase and must both
   survive, because they are two different things */
t('septic shock still earns both the sepsis code and the shock code',()=>{
 const a=all('Admitted in septic shock requiring noradrenaline.');
 return (a.some(c=>/^A41/.test(c))&&a.includes('R57.2'))||'got '+a;});

/* ══════════ 3 · a normal result is not a disease ══════════ */

t('a normal cholesterol is not coded as hyperlipidaemia',()=>{
 const p=pri('56 y male for review. Known hypertension on ramipril, BP 128/76. Cholesterol 4.4. '
  +'Impression: essential hypertension, well controlled.');
 return !p.includes('E78.5')||'E78.5 coded from a normal cholesterol of 4.4';});
t('an actual lipid diagnosis is still coded',()=>{
 const p=pri('54 y male with hyperlipidaemia on atorvastatin. Impression: hyperlipidaemia.');
 return p.includes('E78.5')||'got '+p;});

/* ══════════ 4 · the impression is found in a flowing note ══════════ */

t('an impression that starts a line is read',()=>
 /pneumonia/i.test(_stImpression('History: cough.\nImpression: pneumonia.\nPlan: amoxicillin.')));
t('an impression mid-paragraph is read too',()=>
 /pneumonia/i.test(_stImpression('Cough and fever. CXR consolidation. Impression: pneumonia. Started amoxicillin.'))
 ||'a dictated note hid the doctor’s own diagnosis');
t('the plan is still not read as the impression',()=>{
 const i=_stImpression('Impression: pneumonia.\nPlan: consider asthma review.');
 return (/pneumonia/i.test(i)&&!/asthma/i.test(i))||JSON.stringify(i);});

/* ══════════ 5 · the generic loses to the site ══════════ */

const LUMP='45 y female with a painless lump in the right breast noticed 3 weeks ago. '
 +'Firm mobile 2 cm lump upper outer quadrant. Referred on the two week pathway; '
 +'impression: breast lump for triple assessment.';
t('a breast lump reaches the breast code',()=>pri(LUMP).includes('N63')||'got '+pri(LUMP));
t('the site-unspecified lump code is not returned beside it',()=>
 !all(LUMP).includes('R22.9')||'R22.9 returned alongside N63 for one finding');

/* ══════════ 6 · one principal, always exactly one when nothing is diagnosed ══════════ */

const HEADACHE='29 y female, sudden severe headache, worst of her life, peaked within a minute. '
 +'One episode of vomiting. No neck stiffness. CT head: no haemorrhage seen. '
 +'Plan: lumbar puncture to exclude subarachnoid haemorrhage.';
t('the headache is coded',()=>pri(HEADACHE).includes('R51')||'got '+pri(HEADACHE));
t('the associated vomiting does not also claim to be principal',()=>
 pri(HEADACHE).length===1||'got '+pri(HEADACHE).length+' principals: '+pri(HEADACHE));
t('the vomiting is still recorded',()=>
 all(HEADACHE).includes('R11')||'the vomiting was dropped rather than demoted');
t('the excluded haemorrhage is still not coded',()=>
 !all(HEADACHE).some(c=>/^I60/.test(c))||'coded a haemorrhage the CT excluded');

/* ══════════ 7 · nothing above broke negation ══════════ */

t('a denied diagnosis is still refused',()=>{
 const a=all('Chest pain. Troponin negative, no myocardial infarction. CT ruled out pulmonary embolism.');
 return (!a.some(c=>/^I21/.test(c))&&!a.some(c=>/^I26/.test(c)))||'got '+a;});
t('a family history is still not the patient’s diagnosis',()=>
 !all('Well woman check. Mother has breast cancer.').some(c=>/^C50/.test(c))||'coded a family history');

done();
