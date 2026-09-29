/* Prints how the note matcher reads a few phrases. A debugging aid, not a test.
   Loads the tool through the shared harness, so it runs on the web build
   (tables in data/*.js) as well as a single-file build. */
const {load,makeEnv}=require('./_harness.js');
const {code}=load();makeEnv();
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
