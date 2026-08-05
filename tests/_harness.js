/* Shared headless harness for RxDx. Kept out of /tmp so a sandbox reset
   cannot take the test suite with it. */
const fs=require('fs');
const path=require('path');
/* Resolve the tool wherever it lives: the release repo (../index.html), the
   working copy, or an explicit RXDX_HTML. A test that only runs on one machine
   is not a test. */
function _rxFind(){
 if(process.env.RXDX_HTML&&fs.existsSync(process.env.RXDX_HTML))return process.env.RXDX_HTML;
 const c=[path.join(__dirname,'..','index.html'),
          path.join(__dirname,'..','RxDx.html'),
          '/sessions/busy-elegant-allen/mnt/outputs/RxDx.html'];
 for(const p of c) if(fs.existsSync(p)) return p;
 throw new Error('RxDx html not found. Set RXDX_HTML.');
}
const RX=_rxFind();
/* The web build keeps the two big reference tables in data/*.js so no single
   file is unwieldy. The tests must exercise the same code either way, so if the
   html no longer carries them, load them the way a browser would. */
function _rxData(){
 const dir=path.join(path.dirname(RX),'data');
 if(!fs.existsSync(dir))return '';
 return fs.readdirSync(dir).filter(f=>f.endsWith('.js')).sort()
  .map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
}
function load(){
 const h=fs.readFileSync(RX,'utf8');
 const m=h.indexOf('const IDF');
 if(m>=0) return {html:h,code:h.slice(h.lastIndexOf('<script>',m)+8,h.indexOf('</script>',m))};
 /* split build: the app script is the last one, the tables come from data/ */
 const last=h.lastIndexOf('<script>');
 const app=h.slice(last+8,h.indexOf('</script>',last));
 const data=_rxData();
 if(!data) throw new Error('split build found but data/ is missing next to '+RX);
 return {html:h,code:data+'\nvar IDF=[].concat.apply([],Object.keys(global).filter(k=>/^IDF_\\d+$/.test(k)).sort().map(k=>global[k]));'
   +'\nvar ICD=[].concat.apply([],Object.keys(global).filter(k=>/^ICD_\\d+$/.test(k)).sort().map(k=>global[k]));\n'+app};
}
function makeEnv(){
 function el(id){var o={id:id,value:'',innerHTML:'',textContent:'',className:'',checked:false,style:{},
  options:[],_attr:{},_kids:[],parentNode:{insertBefore(){}},
  classList:{add(c){o.className=(o.className+' '+c).trim();},remove(){},toggle(){},contains:()=>false},
  appendChild(x){o._kids.push(x);},addEventListener(){},focus(){},click(){},remove(){},scrollIntoView(){},
  getAttribute:n=>o._attr[n]||null,setAttribute:(n,v)=>{o._attr[n]=String(v);},
  removeAttribute(n){delete o._attr[n];},
  querySelector:q=>o._kids.filter(k=>('.'+k.className).indexOf(q)>=0)[0]||null,
  querySelectorAll:()=>[],closest:()=>null};return o;}
 const store={},sel={};
 const S=id=>{if(!store[id])store[id]=el(id);return store[id];};
 global.document={getElementById:id=>S(id),
  querySelectorAll:q=>{let r=[];for(const k in sel)if(q.split(',').some(p=>p.trim()===k))r=r.concat(sel[k]);
   return r.length?r:(sel[q]||[]);},
  querySelector:()=>null,createElement:t=>el('_'+t),addEventListener(){},
  body:{classList:{add(){},remove(){},toggle:()=>true},appendChild(){}}};
 global.window=global;global.navigator={clipboard:{writeText(){}},onLine:true,serviceWorker:{}};
 global.location={reload(){},href:''};
 const _ls={};
 global.localStorage={getItem:k=>(_ls[k]===undefined?null:_ls[k]),setItem:(k,v)=>{_ls[k]=String(v);},
  removeItem:k=>{delete _ls[k];},hasOwnProperty:k=>_ls.hasOwnProperty(k)};
 global.sessionStorage={_s:{},getItem(k){return this._s[k]===undefined?null:this._s[k];},
  setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
 global.alert=()=>{};global.confirm=()=>false;global.prompt=()=>'documented reason';
 /* Short timers fire at once so the tests stay synchronous; long ones are held
    so a test can decide whether the wait expires. */
 global._timers=[];
 global.setInterval=()=>1;
 global.setTimeout=(f,ms)=>{if(typeof f!=='function')return 1;
  if(!ms||ms<500){try{f();}catch(_){}return 1;}
  global._timers.push(f);return global._timers.length;};
 global.clearTimeout=id=>{if(id&&global._timers[id-1])global._timers[id-1]=null;};
 global._fireTimers=()=>{const q=global._timers;global._timers=[];
  q.forEach(f=>{if(f)try{f();}catch(_){}});};global.fetch=()=>Promise.reject(0);
 global.Blob=function(p){this.p=p;};global.URL={createObjectURL:()=>'x',revokeObjectURL(){}};
 return {S,store,sel,reset(){for(const k in store)delete store[k];for(const k in sel)delete sel[k];
  window._hxWho=null;window._hxDx=[];window._edDx=[];window._edABC={};window._edProc={};}};
}
function runner(){
 let P=0,F=0;
 const t=(n,f)=>{try{const r=f();if(r===true||r===undefined)P++;else{F++;console.log('  FAIL',n,'→',r);}}
  catch(e){F++;console.log('  ERR ',n,'→',e.message);}};
 const done=()=>{console.log(P+' passed, '+F+' failed');process.exit(F?1:0);};
 return {t,done};
}
module.exports={load,makeEnv,runner};
