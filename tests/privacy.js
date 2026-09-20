const fs=require('fs');
const path=require('path');
const H=require('./_harness.js');
const {html,code}=H.load();
const {S}=H.makeEnv();
const {t,done}=H.runner();
const NAMES=['encEnabled','encSetEnabled','encCapture','encList','napiBase','napiSecure',
 'napiOn','napiConsent','napiSendCurrent','analyzeNote'];
eval(code+'\n;NAMES.forEach(function(n){try{global[n]=eval(n);}catch(_){}});');

t('workspace switcher is explicitly not authentication',()=>
 /choose a workspace \(this is not a sign-in\)/i.test(html)&&
 /does not authenticate you or grant access/i.test(html)&&
 /Switch workspace/.test(html));

t('encounter telemetry is opt-in and defaults off',()=>{
 localStorage.removeItem('rxdx_enc_enabled_v1');
 return encEnabled()===false;
});

t('disabled telemetry captures no encounter',()=>{
 localStorage.removeItem('rxdx_enc_enabled_v1');
 localStorage.removeItem('rxdx_enc_v1');
 S('hx-input').value='Chest pain';
 window._hxDx=[{code:'I20.9'}];
 encCapture('clinic','final',false);
 return encList().length===0;
});

t('enabled telemetry stores coded metrics but never note content',()=>{
 localStorage.setItem('rxdx_enc_enabled_v1','1');
 localStorage.removeItem('rxdx_enc_v1');
 S('hx-input').value='Chest pain';
 S('hx-note-extra').value='SECRET NOTE CONTENT';
 window._hxDx=[{code:'I20.9'}];
 encCapture('clinic','final',false);
 const raw=localStorage.getItem('rxdx_enc_v1')||'';
 return /Chest pain/.test(raw)&&/I20\.9/.test(raw)&&!/SECRET NOTE CONTENT/.test(raw);
});

t('external note coding requires HTTPS',()=>{
 S('napi-url').value='http://coding.example';
 return napiSecure()===false&&/HTTPS is required/.test(S('napi-state').textContent);
});

t('external note coding requires per-session consent',()=>{
 S('napi-on').checked=true;
 S('napi-url').value='https://coding.example';
 sessionStorage.removeItem('rxdx.codingApiConsent');
 if(napiOn())return false;
 napiConsent({checked:true});
 return napiOn()===true;
});

t('ordinary Analyze remains local even when external service is configured',()=>{
 S('note-input').value='Patient has hypertension.';
 S('napi-on').checked=true;
 S('napi-url').value='https://coding.example';
 napiConsent({checked:true});
 let calls=0;global.fetch=()=>{calls++;return Promise.reject(new Error('unexpected'));};
 analyzeNote();
 return calls===0;
});

t('network warning cannot be hidden by publicDemo response',()=>
 !/publicDemo\s*===\s*false[\s\S]{0,160}napi-warn/.test(html));

t('backend has closed CORS and authenticated processing defaults',()=>{
 const py=fs.readFileSync(path.join(__dirname,'..','backend','app.py'),'utf8');
 return /RXDX_ALLOW_ORIGINS",\s*""/.test(py)&&
  /RXDX_ALLOW_INSECURE_WRITES/.test(py)&&
  /insecure writes are disabled/.test(py)&&
  /def insights\([^)]*x_api_key:/.test(py)&&
  /def get_pending\([^)]*x_api_key:/.test(py)&&
  /def ner\(item: NerIn, x_api_key:/.test(py)&&
  /def extract\(item: ExtractIn, x_api_key:/.test(py);
});

t('payer guidance is not labelled guaranteed acceptance',()=>
 /not a guarantee of payer acceptance/i.test(html)&&
 /Actual acceptance depends on the payer/i.test(html));

done();