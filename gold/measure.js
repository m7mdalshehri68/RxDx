/* Accuracy measurement against the hand-labelled corpus.
   Labels were written from the note alone, never from the tool's output. */
const fs=require('fs');
const h=fs.readFileSync('/sessions/busy-elegant-allen/mnt/outputs/RxDx.html','utf8');
const mi=h.indexOf('const IDF');const s=h.lastIndexOf('<script>',mi)+8;const e=h.indexOf('</script>',mi);
const code=h.slice(s,e);
function el(id){var o={id:id,value:'',innerHTML:'',className:'',checked:false,style:{},options:[],_attr:{},parentNode:{insertBefore(){}},classList:{add(){},remove(){},toggle(){},contains:()=>false},appendChild(){},addEventListener(){},focus(){},click(){},remove(){},scrollIntoView(){},getAttribute:n=>o._attr[n]||null,setAttribute:(n,v)=>{o._attr[n]=String(v);},removeAttribute(){},querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null};return o;}
var store={};function S(id){if(!store[id])store[id]=el(id);return store[id];}
global.document={getElementById:id=>S(id),querySelectorAll:()=>[],querySelector:()=>null,createElement:t=>el(t),addEventListener(){},body:{classList:{add(){},remove(){},toggle:()=>true},appendChild(){}}};
global.window=global;global.navigator={clipboard:{writeText(){}},onLine:true};global.location={reload(){},protocol:'https:'};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){},hasOwnProperty:()=>false};
global.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.alert=()=>{};global.confirm=()=>true;global.prompt=()=>'';global.setInterval=()=>1;
global.setTimeout=f=>{if(typeof f==='function'){try{f();}catch(_){}}return 1;};global.clearTimeout=()=>{};
global.fetch=()=>Promise.reject(0);global.Blob=function(){};global.URL={createObjectURL:()=>'x',revokeObjectURL(){}};
eval(code+';Object.assign(global,{_stProblems,_stMeds,_buildNoteIndexes,ICD_MAP,ICD,SYN,_ABBR_CASE,_NEEDS_CONTEXT});');

const corpus=JSON.parse(fs.readFileSync(__dirname+'/corpus.json','utf8'));
const idx=_buildNoteIndexes();
const termToCode={}; idx.probTerms.forEach(t=>{termToCode[t.term.toLowerCase()]=t.code;});
const reachable=new Set(idx.probTerms.map(t=>t.code));

/* does the tool have any way at all to reach this concept from free text? */
function conceptCode(phrase){
 const p=phrase.toLowerCase().trim();
 if(termToCode[p])return termToCode[p];
 let best=null;
 for(const t in termToCode){ if(t===p||t.includes(p)||p.includes(t)){ if(!best||t.length>best.length)best=t; } }
 return best?termToCode[best]:null;
}
const cat=c=>String(c).split('.')[0];

let TP=0,FP=0,FN=0, cTP=0,cFP=0,cFN=0;
let negTested=0,negPassed=0,negVacuous=0;
let drugTP=0,drugFN=0;
const unreachable=[],failures=[],negFails=[];

corpus.forEach(n=>{
 const low=' '+n.note.toLowerCase().replace(/\s+/g,' ')+' ';
 const raw=_stProblems(n.note,low);const pred=raw.filter(x=>x.principal!==false).map(x=>x.code);
 const predSet=new Set(pred), predCat=new Set(pred.map(cat));
 const goldSet=new Set(n.codes), goldCat=new Set(n.codes.map(cat));

 n.codes.forEach(g=>{
  if(!reachable.has(g)&&!reachable.has(cat(g))) unreachable.push(n.id+' '+g);
  if(predSet.has(g))TP++;else{FN++;failures.push({id:n.id,miss:g,concept:n.concepts[0]||''});}
 });
 pred.forEach(p=>{ if(!goldSet.has(p))FP++; });
 goldCat.forEach(g=>{ if(predCat.has(g))cTP++;else cFN++; });
 predCat.forEach(p=>{ if(!goldCat.has(p))cFP++; });

 (n.must_not_code||[]).forEach(t=>{
  const c=conceptCode(t);
  if(!c){negVacuous++;return;}          /* the tool could never code it — not a real test */
  negTested++;
  if(!predSet.has(c))negPassed++;
  else negFails.push({id:n.id,term:t,coded:c});
 });

 const meds=_stMeds(n.note,low).join(' ').toLowerCase();
 (n.drugs||[]).forEach(d=>{ if(meds.includes(d.toLowerCase().split(' ')[0]))drugTP++;else drugFN++; });
});

const pc=(a,b)=>b?(a/b*100).toFixed(1)+'%':'—';
const f1=(p,r)=>(p+r)?(2*p*r/(p+r)*100).toFixed(1)+'%':'—';
const P=TP/(TP+FP||1), R=TP/(TP+FN||1);
const cP=cTP/(cTP+cFP||1), cR=cTP/(cTP+cFN||1);

console.log('╔'+'═'.repeat(62)+'╗');
console.log('║  RxDx extraction accuracy · '+corpus.length+' hand-labelled notes'.padEnd(33)+'║');
console.log('╚'+'═'.repeat(62)+'╝');
console.log();
console.log('DIAGNOSIS CODES — exact code');
console.log('  precision '+pc(TP,TP+FP)+'   recall '+pc(TP,TP+FN)+'   F1 '+f1(P,R));
console.log('  correct '+TP+' · missed '+FN+' · extra '+FP);
console.log();
console.log('DIAGNOSIS CODES — 3-character category (J18.9 counts as J18)');
console.log('  precision '+pc(cTP,cTP+cFP)+'   recall '+pc(cTP,cTP+cFN)+'   F1 '+f1(cP,cR));
console.log();
console.log('NEGATION — a denied or excluded finding must not be coded');
console.log('  tested '+negTested+' · passed '+negPassed+'  ('+pc(negPassed,negTested)+')');
console.log('  '+negVacuous+' traps were vacuous: the tool has no term for them at all,');
console.log('  so passing them proves nothing and they are excluded from the score.');
console.log();
console.log('DRUG NAMES');
console.log('  found '+drugTP+' of '+(drugTP+drugFN)+'  ('+pc(drugTP,drugTP+drugFN)+')');
console.log();
if(unreachable.length){
 console.log('CEILING — gold codes the extractor can never reach ('+unreachable.length+'):');
 console.log('  '+unreachable.join(', '));console.log();}
if(failures.length){
 console.log('MISSED ('+failures.length+'):');
 failures.forEach(f=>console.log('  '+f.id+'  '+f.miss.padEnd(8)+f.concept));console.log();}
if(negFails.length){
 console.log('NEGATION FAILURES ('+negFails.length+') — coded something the note denied:');
 negFails.forEach(f=>console.log('  '+f.id+'  "'+f.term+'" → coded '+f.coded));}
