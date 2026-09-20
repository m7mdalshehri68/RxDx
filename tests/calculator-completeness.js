/* Targeted safety regressions for the free-text auto calculators. */
const {load,makeEnv,runner}=require('./_harness.js');
const {code}=load();makeEnv();
eval(code+';Object.assign(global,{_calcParse,_news2,_qsofa,_curb,_calcCard,_calcList,CHADS});');
const {t,done}=runner();

const complete={
 rr:16,spo2:97,oxygen:false,sbp:120,dbp:75,hr:70,
 confusion:false,temp:37,urea:5,age:45
};
const withValue=(key,value)=>Object.assign({},complete,{[key]:value});

t('absence of confusion and oxygen remains unknown',()=>{
 const p=_calcParse('RR 16, SpO2 97%, BP 120/75, HR 70, Temp 37 C.');
 return p.confusion===null&&p.oxygen===null||JSON.stringify(p);
});
t('negated confusion is documented normal',()=>_calcParse('No confusion.').confusion===false);
t('GCS 15 is not scored as altered mentation',()=>_calcParse('GCS 15.').confusion===false);
t('GCS below 15 is altered mentation',()=>_calcParse('GCS 14.').confusion===true);
t('a positive confusion statement still scores',()=>_calcParse('Patient is confused.').confusion===true);
t('room air and no oxygen are documented as no supplemental oxygen',()=>{
 return _calcParse('SpO2 95% on room air.').oxygen===false&&
   _calcParse('Not on oxygen.').oxygen===false;
});
t('oxygen saturation wording alone is not oxygen therapy',()=>_calcParse('Oxygen saturation 95%.').oxygen===null);
t('documented oxygen therapy is recognised',()=>_calcParse('On oxygen 2 L/min via nasal cannula.').oxygen===true);

t('NEWS does not issue a risk band with missing inputs',()=>{
 const r=_news2(withValue('oxygen',null));
 return r.partial&&/incomplete/i.test(r.band)&&!/low|routine/i.test(r.band);
});
t('qSOFA does not label incomplete data Low',()=>{
 const r=_qsofa({rr:16,sbp:null,confusion:false});
 return r.partial&&/incomplete/i.test(r.band)&&r.miss.indexOf('SBP')>=0;
});
t('CURB-65 does not label incomplete data Low',()=>{
 const r=_curb({rr:20,sbp:120,dbp:80,confusion:false,urea:null,age:50});
 return r.partial&&/incomplete/i.test(r.band)&&r.miss.indexOf('urea')>=0;
});
t('rendering calls an incomplete score partial and never assumed normal',()=>{
 const h=_calcCard('qSOFA',_qsofa({rr:null,sbp:null,confusion:null}));
 return /Partial score/.test(h)&&/not scored/.test(h)&&!/assumed normal/i.test(h);
});
t('NEWS single parameter score of 3 gets the single-3 escalation',()=>{
 const r=_news2(withValue('rr',8));
 return r.score===3&&r.single3&&/single parameter scored 3/i.test(r.band);
});
t('NEWS single-3 escalation survives other missing inputs without claiming Low',()=>{
 const r=_news2({rr:8,spo2:null,oxygen:null,sbp:null,hr:null,confusion:null,temp:null});
 return r.partial&&/single parameter scored 3/i.test(r.band)&&!/low/i.test(r.band);
});

t('Fahrenheit temperature is converted to Celsius',()=>{
 const p=_calcParse('Temp 101.3 F.');
 return Math.abs(p.temp-38.5)<0.01||p.temp;
});
t('Celsius temperature remains Celsius',()=>_calcParse('Temperature 38.5 Celsius.').temp===38.5);
t('unsupported explicit temperature units are not scored',()=>_calcParse('Temp 310 Kelvin.').temp===null);
t('urea mg/dL is converted to mmol/L',()=>{
 const p=_calcParse('Urea 48.048 mg/dL.');
 return Math.abs(p.urea-8)<0.01||p.urea;
});
t('BUN mg/dL is converted to urea-equivalent mmol/L',()=>{
 const p=_calcParse('BUN 22.408 mg/dL.');
 return Math.abs(p.urea-8)<0.01||p.urea;
});
t('unsupported explicit urea units are not scored',()=>_calcParse('Urea 9 g/L.').urea===null);
t('CHA2DS2-VASc age choices declare one exclusive group',()=>{
 const h=_calcList('chads',CHADS);
 return (h.match(/data-exclusive="chads-age"/g)||[]).length===2;
});

done();