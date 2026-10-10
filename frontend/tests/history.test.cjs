const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compareSnapshots}=require('../work/history-tests/history.js');

const file=(path,hash)=>({id:path,path,hash,language:'Python',size:10,lines:10});
const proof=(hash,line=3)=>({file_id:'main.py',path:'main.py',start_line:line,end_line:line,extractor:'Python AST',source_hash:hash});
function snapshot(id,files,graph={nodes:[],edges:[],analyzer_version:'v1'}) {
  return {id,name:id,created_at:id,files,contents:{},graph,persisted:false,summary:{file_count:files.length}};
}
function routeGraph(hash,line=3,path='/upload') {
  return {analyzer_version:'v1',nodes:[{id:'main.py',kind:'file',label:'main.py',file_id:'main.py'},
    {id:`route-${line}-${path}`,kind:'route',label:`POST ${path}`,file_id:'main.py',line}],
    edges:[{id:`edge-${line}-${path}`,source:`route-${line}-${path}`,target:'main.py',kind:'implemented_by',confidence:'observed',evidence:[proof(hash,line)]}]};
}

test('identical snapshots have no file or graph deltas and are not mutated',()=>{
  const a=snapshot('old',[file('main.py','a')],routeGraph('a'));
  const original=JSON.stringify(a);
  const delta=compareSnapshots(a,structuredClone(a));
  assert.equal(delta.compatible,true);
  assert.deepEqual([delta.files,delta.nodes,delta.edges],[[],[],[]]);
  assert.equal(JSON.stringify(a),original);
});
test('file additions, removals and modifications use paths and hashes; rename is removal plus addition',()=>{
  const a=snapshot('old',[file('main.py','a'),file('removed.py','b'),file('old-name.py','c')]);
  const b=snapshot('new',[file('main.py','d'),file('added.py','e'),file('new-name.py','c')]);
  assert.deepEqual(compareSnapshots(a,b).files.map(item=>[item.key,item.status]),[
    ['added.py','added'],['main.py','updated'],['new-name.py','added'],['old-name.py','removed'],['removed.py','removed']]);
});
test('moving route declarations updates evidence without inventing added/removed relationships',()=>{
  const a=snapshot('old',[file('main.py','a')],routeGraph('a',3));
  const b=snapshot('new',[file('main.py','b')],routeGraph('b',8));
  const delta=compareSnapshots(a,b);
  assert.equal(delta.edges.length,1);
  assert.equal(delta.edges[0].status,'updated');
  assert.equal(delta.beforeChanges.edges['edge-3-/upload'],'updated');
  assert.equal(delta.afterChanges.edges['edge-8-/upload'],'updated');
  assert.ok(delta.nodes.every(item=>item.status==='updated'));
});
test('a changed route path creates a removed and an added declaration, with version-specific evidence IDs',()=>{
  const a=snapshot('old',[file('main.py','a')],routeGraph('a',3,'/upload'));
  const b=snapshot('new',[file('main.py','b')],routeGraph('b',3,'/documents'));
  const delta=compareSnapshots(a,b);
  assert.deepEqual(delta.edges.map(item=>item.status).sort(),['added','removed']);
  assert.equal(delta.beforeChanges.edges['edge-3-/upload'],'removed');
  assert.equal(delta.afterChanges.edges['edge-3-/documents'],'added');
});
test('different or missing analyzer versions withhold graph deltas but retain file changes',()=>{
  const a=snapshot('old',[file('main.py','a')],routeGraph('a'));
  const b=snapshot('new',[file('main.py','b')],{...routeGraph('b'),analyzer_version:'v2'});
  const delta=compareSnapshots(a,b);
  assert.equal(delta.compatible,false);assert.equal(delta.files.length,1);assert.deepEqual(delta.edges,[]);
  assert.equal(compareSnapshots(a,{...b,graph:undefined}).compatible,false);
});
test('duplicate evidence-bearing edges are aggregated by their endpoints and relationship kind',()=>{
  const graph=routeGraph('a');graph.edges.push({...graph.edges[0],id:'duplicate'});
  const a=snapshot('old',[file('main.py','a')],graph);
  const b=snapshot('new',[file('main.py','a')],routeGraph('a'));
  assert.deepEqual(compareSnapshots(a,b).edges,[]);
});
