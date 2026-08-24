/* FHIR R4 export, and dictation that does not silently drop Arabic. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();const {S,reset}=makeEnv();
eval(code+';Object.assign(global,{fhirBundle,fhirText,fhirRender,rxDictLang,rxDictSetLang,'+
 'RX_DICT_LANGS,hxDxAdd,HX_DOCS,ICD_MAP,window});');
const {t,done}=runner();
function scene(){reset();
 S('hx-input').value='Chest pain';hxDxAdd('I20.0');hxDxAdd('I10');
 S('hx-allergy').value='penicillin — rash';
 S('hx-out').value='58 y male with chest pain.\nImpression: unstable angina.';
 return fhirBundle('hx');}

t('the bundle is a valid FHIR transaction',()=>{const b=scene();
 return (b.resourceType==='Bundle'&&b.type==='transaction'&&Array.isArray(b.entry))||JSON.stringify(b).slice(0,120);});
t('every coded diagnosis becomes a Condition',()=>{const b=scene();
 const c=b.entry.filter(e=>e.resource.resourceType==='Condition');
 return c.length===2||('got '+c.length);});
t('a Condition carries the ICD-10-AM system and the code',()=>{const b=scene();
 const c=b.entry.find(e=>e.resource.resourceType==='Condition').resource.code.coding[0];
 return (c.system==='http://hl7.org/fhir/sid/icd-10-am'&&c.code==='I20.0')||JSON.stringify(c);});
t('a Condition carries the human-readable description too',()=>{const b=scene();
 const c=b.entry.find(e=>e.resource.resourceType==='Condition').resource.code.coding[0];
 return (typeof c.display==='string'&&c.display.length>3)||JSON.stringify(c);});
t('the allergy becomes an AllergyIntolerance',()=>{const b=scene();
 const a=b.entry.find(e=>e.resource.resourceType==='AllergyIntolerance');
 return (a&&/penicillin/i.test(a.resource.code.text))||'no allergy resource';});
t('"NKDA" produces no allergy resource, because it is not an allergy',()=>{reset();
 S('hx-input').value='Chest pain';hxDxAdd('I20.0');S('hx-allergy').value='NKDA';
 return fhirBundle('hx').entry.every(e=>e.resource.resourceType!=='AllergyIntolerance');});
t('the note becomes a DocumentReference',()=>{const b=scene();
 const d=b.entry.find(e=>e.resource.resourceType==='DocumentReference');
 return (d&&d.resource.content[0].attachment.contentType==='text/plain')||'no document';});
t('the note is base64 encoded, as FHIR requires',()=>{const b=scene();
 const d=b.entry.find(e=>e.resource.resourceType==='DocumentReference');
 const raw=Buffer.from(d.resource.content[0].attachment.data,'base64').toString('utf8');
 return /unstable angina/i.test(raw)||raw.slice(0,80);});

/* the part that matters most */
t('no patient identifier is ever invented',()=>{const b=scene();
 const s=JSON.stringify(b);
 return !/"identifier"/.test(s)&&!/Patient\//.test(s)||'an identifier was created';});
t('the subject is left for the sending system to fill',()=>{const b=scene();
 const c=b.entry.find(e=>e.resource.resourceType==='Condition').resource;
 return /to be supplied by the sending system/.test(JSON.stringify(c.subject))||JSON.stringify(c.subject);});
t('nothing is exported from an empty encounter',()=>{reset();
 return fhirBundle('hx').entry.length===0;});
t('the panel says so rather than offering an empty file',()=>{reset();
 return /Nothing to export yet/.test(fhirRender('hx'));});
t('each entry carries the POST request a server needs',()=>{const b=scene();
 return b.entry.every(e=>e.request&&e.request.method==='POST'&&e.request.url)||'a request block is missing';});
t('the bundle is real JSON',()=>{scene();
 try{JSON.parse(fhirText('hx'));return true;}catch(e){return e.message;}});
t('FHIR is reachable from the note documents',()=>
 HX_DOCS.some(d=>d[0]==='fhir')||HX_DOCS.map(d=>d[0]).join());

/* dictation */
t('dictation defaults to Saudi English, not US English',()=>rxDictLang()==='en-SA');
t('Arabic can be chosen',()=>{rxDictSetLang('ar-SA');const v=rxDictLang();rxDictSetLang('en-SA');
 return v==='ar-SA'||('got '+v);});
t('both languages are offered',()=>RX_DICT_LANGS.length===2&&RX_DICT_LANGS.some(x=>x[0]==='ar-SA'));
done();
