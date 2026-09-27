/* Discharge coding — the whole point is the codes the stay produced that the
   admission diagnosis never had. Every claim here is exercised, not asserted. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code,html}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{dcText,dcAnalyse,dcCopy,RX_NAV,_stProblems,ICD_MAP,window});');
const {t,done}=runner();

const fill=o=>{reset();Object.keys(o).forEach(k=>{S(k).value=o[k];});};

/* ---- it is reachable at all ---- */
t('the panel exists in the page',()=>/id="panel-discharge"/.test(html));
t('the doctor navigation offers it',()=>
 JSON.stringify(RX_NAV.doctor).indexOf('"discharge"')>=0||'not in doctor nav');
t('all seven summary boxes exist in the page',()=>
 ['dc-adm','dc-course','dc-proc','dc-comp','dc-dx','dc-meds','dc-plan']
  .filter(i=>html.indexOf('id="'+i+'"')<0).join(', ')||true);
t('the output box exists in the page',()=>/id="dc-out"/.test(html));
t('something calls dcAnalyse from the page',()=>/dcAnalyse\(\)/.test(html));

/* ---- an empty form does not pretend ---- */
t('an empty summary asks to be filled',()=>{fill({});dcAnalyse();
 return /Fill the summary/.test(S('dc-out').innerHTML);});
t('a scrap of text is treated as empty',()=>{fill({'dc-adm':'ok'});dcAnalyse();
 return /Fill the summary/.test(S('dc-out').innerHTML);});
t('a real two-word diagnosis is coded, not dismissed',()=>{
 fill({'dc-adm':'Community acquired pneumonia'});dcAnalyse();
 return !/Fill the summary/.test(S('dc-out').innerHTML)||'a real diagnosis was dismissed as empty';});

/* ---- the case that matters ---- */
const CASE={'dc-adm':'Community acquired pneumonia',
 'dc-course':'Developed acute kidney injury on day 3, creatinine peaked at 240',
 'dc-dx':'Community acquired pneumonia. Acute kidney injury, resolved.',
 'dc-meds':'Amoxicillin clavulanate 1 g twice daily for 5 more days',
 'dc-plan':'Chest x-ray in 6 weeks. Repeat creatinine in one week.'};

t('pneumonia is coded from the summary',()=>{fill(CASE);dcAnalyse();
 return /J1[0-8]/.test(S('dc-out').innerHTML)||'no pneumonia code: '+S('dc-out').innerHTML.slice(0,300);});
t('the acute kidney injury the stay produced is coded',()=>{fill(CASE);dcAnalyse();
 return /N17/.test(S('dc-out').innerHTML)||'no N17: '+S('dc-out').innerHTML.slice(0,300);});
t('a traumatic kidney injury is NOT coded from "kidney injury"',()=>{fill(CASE);dcAnalyse();
 return !/S37/.test(S('dc-out').innerHTML)||'traumatic kidney injury coded';});
t('the codes the stay produced are called out separately',()=>{fill(CASE);dcAnalyse();
 return /dc-new/.test(S('dc-out').innerHTML)||'nothing flagged as new since admission';});
t('the flagged-new list names the kidney injury, not the pneumonia',()=>{fill(CASE);dcAnalyse();
 const m=/<div class="dc-new">([\s\S]*?)<\/div>/.exec(S('dc-out').innerHTML);
 if(!m)return 'no dc-new block';
 return (/N17/.test(m[1])&&!/J1[0-8]/.test(m[1]))||'wrong split: '+m[1];});

/* ---- the admission-only comparison is honest ---- */
t('nothing is flagged as new when the stay added nothing',()=>{
 fill({'dc-adm':'Community acquired pneumonia',
       'dc-dx':'Community acquired pneumonia, treated and resolved',
       'dc-plan':'Chest x-ray in 6 weeks'});dcAnalyse();
 return !/dc-new/.test(S('dc-out').innerHTML)||'flagged new with nothing new';});

/* ---- negation still holds here ---- */
t('a ruled-out diagnosis in the course is not coded',()=>{
 fill({'dc-adm':'Chest pain for assessment',
       'dc-course':'Serial troponins negative, no myocardial infarction. CT ruled out pulmonary embolism.',
       'dc-dx':'Non cardiac chest pain'});dcAnalyse();
 const o=S('dc-out').innerHTML;
 return (!/I21/.test(o)&&!/I26/.test(o))||'coded something that was ruled out: '+o.slice(0,300);});

/* ---- text collection ---- */
t('dcText gathers every box',()=>{fill(CASE);
 const x=dcText();
 return (/pneumonia/i.test(x)&&/kidney/i.test(x)&&/Amoxicillin/i.test(x))||'missing a box: '+x;});
t('dcText ignores boxes that were left empty',()=>{
 fill({'dc-adm':'sepsis'});return dcText().trim()==='sepsis'||'got: '+JSON.stringify(dcText());});

/* ---- copy ---- */
t('copying does not throw and produces code — description lines',()=>{fill(CASE);
 let got='';global.navigator.clipboard={writeText:s=>{got=s;}};
 dcCopy();
 return /^[A-Z]\d+.*—.+/m.test(got)||'clipboard text was: '+JSON.stringify(got);});

/* ---- a second, unrelated admission ---- */
t('a diabetic foot admission codes the infection that developed',()=>{
 fill({'dc-adm':'Type 2 diabetes mellitus with foot ulcer',
       'dc-course':'Wound swab grew MRSA. Developed cellulitis of the left foot.',
       'dc-dx':'Diabetic foot ulcer. Cellulitis.'});dcAnalyse();
 const o=S('dc-out').innerHTML;
 return /L03/.test(o)||'cellulitis not coded: '+o.slice(0,300);});

/* ---- vocabulary corrections this feature exposed ----
   Each of these was mapped to a different disease. A discharge summary is
   where the error would have been billed, so the guard belongs here. */
const codeFor=term=>{const f=_stProblems(term,' '+term.toLowerCase()+' ');
 return f.map(x=>x.code).join(',');};
t('cellulitis is cellulitis, not erysipelas',()=>{
 const c=codeFor('Cellulitis of the leg treated with flucloxacillin');
 return (/L03/.test(c)&&!/A46/.test(c))||'got '+c;});
t('erysipelas still reaches its own code',()=>
 /A46/.test(codeFor('Erysipelas of the cheek'))||'got '+codeFor('Erysipelas of the cheek'));
t('a scalp bruise is a contusion, not an insect bite',()=>{
 const c=codeFor('Scalp bruise after a fall, no loss of consciousness');
 return (/S00\.05/.test(c)&&!/S00\.93/.test(c))||'got '+c;});
t('a facial contusion is a contusion, not an insect bite',()=>{
 const c=codeFor('Facial contusion over the left cheek');
 return (/S00\.85/.test(c)&&!/S00\.83/.test(c))||'got '+c;});
t('a calf muscle strain is not an Achilles injury',()=>{
 const c=codeFor('Calf muscle strain while running');
 return (/S86\.1/.test(c)&&!/S86\.0/.test(c))||'got '+c;});
t('septic shock earns the shock code as well as the sepsis code',()=>{
 const c=codeFor('Admitted in septic shock requiring noradrenaline');
 return (/A41/.test(c)&&/R57\.2/.test(c))||'got '+c;});
t('prediabetes is a diagnosis, not a laboratory finding',()=>{
 const c=codeFor('Prediabetes on screening, HbA1c 6.0');
 return (/E09/.test(c)&&!/\bR73\b/.test(c))||'got '+c;});

done();
