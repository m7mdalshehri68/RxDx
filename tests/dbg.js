const fs=require('fs');const path=require('path');
function _rxFind(){ if(process.env.RXDX_HTML&&fs.existsSync(process.env.RXDX_HTML))return process.env.RXDX_HTML;
 for(const p of [path.join(__dirname,'..','index.html'),path.join(__dirname,'..','RxDx.html'),
   '/sessions/busy-elegant-allen/mnt/outputs/RxDx.html']) if(fs.existsSync(p))return p;
 throw new Error('RxDx html not found. Set RXDX_HTML.'); }
const h=fs.readFileSync(_rxFind(),'utf8');
const m=h.indexOf('const IDF');const s=h.lastIndexOf('<script>',m)+8;const e=h.indexOf('</script>',m);const code=h.slice(s,e);
function el(id){var o={id:id,value:'',innerHTML:'',className:'',checked:false,style:{},options:[],_attr:{},_kids:[],parentNode:{insertBefore(){}},classList:{add(){},remove(){},toggle(){},contains:()=>false},appendChild(){},addEventListener(){},focus(){},click(){},remove(){},scrollIntoView(){},getAttribute:n=>o._attr[n]||null,setAttribute:(n,v)=>{o._attr[n]=String(v);},removeAttribute(){},querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null};return o;}
var store={};function S(id){if(!store[id])store[id]=el(id);return store[id];}
global.document={getElementById:id=>S(id),querySelectorAll:()=>[],querySelector:()=>null,createElement:t=>el(t),addEventListener(){},body:{classList:{add(){},remove(){},toggle:()=>true},appendChild(){}}};
global.window=global;global.navigator={clipboard:{writeText(){}}};global.location={reload(){}};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){},hasOwnProperty:()=>false};
global.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.alert=()=>{};global.confirm=()=>true;global.prompt=()=>'';global.setInterval=()=>1;global.setTimeout=(f)=>{if(typeof f==='function'){try{f();}catch(_){}}return 1;};global.clearTimeout=()=>{};
global.fetch=()=>Promise.reject(0);global.Blob=function(){};global.URL={createObjectURL:()=>'x',revokeObjectURL(){}};
eval(code+'\n;Object.assign(global,{_buildNoteIndexes,_wordRe,_stCtx,ST_NEG,ST_ATTRIB,ST_HYPO,_stActive,_stProblems});');
const _idx=_buildNoteIndexes();
console.log('probTerms:',_idx.probTerms.length);
console.log('sample:',_idx.probTerms.slice(0,8).map(x=>x.term+'→'+x.code));
console.log('has tonsillitis:',_idx.probTerms.filter(x=>/tonsil/.test(x.term)).slice(0,4));
console.log('has diabetes:',_idx.probTerms.filter(x=>/diabetes/.test(x.term)).slice(0,3));
['Type 2 diabetes mellitus','Patient has asthma','acute tonsillitis'].forEach(note=>{
 console.log('══',JSON.stringify(note));
 const idx=_buildNoteIndexes();
 const low=note.toLowerCase();
 const hits=idx.probTerms.filter(p=>low.indexOf(p.term)>=0).slice(0,5);
 hits.forEach(p=>{
  const re=_wordRe(p.term);re.lastIndex=0;const mm=re.exec(note);
  if(!mm){console.log('   ',JSON.stringify(p.term),'— no word-boundary match');return;}
  const c=_stCtx(note,mm.index,mm[0].length);
  console.log('   ',JSON.stringify(p.term),'| before',JSON.stringify(c.before),'| after',JSON.stringify(c.after),
   '| NEG',ST_NEG.test(c.before),'ATTR',ST_ATTRIB.test(c.clause),'HYPO',ST_HYPO.test(c.before),'→ active',_stActive(note,mm[0],mm.index));
 });
 console.log('   result:',_stProblems(note,' '+low+' ').map(x=>x.code));
});
