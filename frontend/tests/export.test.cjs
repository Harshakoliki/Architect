const {test}=require('node:test');
const assert=require('node:assert/strict');
const {exportReport}=require('../work/history-tests/export.js');
const {readResponse}=require('../work/history-tests/api.js');

const proof={file_id:'main',path:'<script>[main](evil).py',start_line:2,end_line:4,source_hash:'abc123',extractor:'Python AST'};
const snapshot={id:'test',name:'<script>unsafe</script>',created_at:'2026-10-10T08:00:00Z',contents:{main:'PRIVATE_SOURCE_SENTINEL'},persisted:false,
  files:[{id:'main',path:proof.path,hash:'abc123',lines:10,language:'Python',size:10}],
  summary:{file_count:1,coverage:'Partial source coverage'},graph:{nodes:[{id:'main',label:'main.py',kind:'file'}],
    edges:[{id:'edge',source:'main',target:'main',kind:'imports',confidence:'observed',evidence:[proof,proof]}],gaps:[{message:'Dynamic targets unsupported'}],analyzer_version:'v1',parsed_files:1}};
test('exports link deduplicated evidence, preserve confidence/hash/gaps, escape Markdown, omit source',()=>{
  const result=exportReport(snapshot);
  assert.match(result.markdown,/\[E1\]\(#evidence-1\)/);
  assert.equal((result.markdown.match(/id="evidence-1"/g)||[]).length,1);
  assert.ok(!result.markdown.includes('<script>'));
  assert.ok(result.markdown.includes('\\[main\\]\\(evil\\)'));
  for(const format of Object.values(result)) {
    assert.ok(!format.includes('PRIVATE_SOURCE_SENTINEL'));
    assert.ok(format.includes('abc123') && format.includes('observed') && format.includes('Dynamic targets unsupported'));
  }
  assert.equal(JSON.parse(result.json).schema_version,1);
  assert.ok(!('contents' in JSON.parse(result.json)));
});
test('product explanations export citations without reviewed source excerpt contents',()=>{
  const meaning={provider:'annotated_sample',model:'none',version:'v1',gaps:['Order inferred'],
    evidence:[{...proof,id:'s1',content:'PRIVATE_EXCERPT_SENTINEL'}],features:[{title:'Upload',summary:'Receive a document',evidence_ids:['s1'],
      journeys:[{title:'Upload journey',steps:[{id:'step',title:'Send',description:'Send document',evidence_ids:['s1']}],transitions:[]}],data_flows:[]}]};
  const result=exportReport(snapshot,meaning);
  assert.match(result.markdown,/Product interpretation · inferred/);
  assert.match(result.markdown,/Send document/);
  assert.match(result.markdown,/Order inferred/);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_EXCERPT_SENTINEL'));
});
test('inventory-only scans still export with honest missing graph state',()=>{
  const result=exportReport({...snapshot,graph:undefined});
  assert.match(result.markdown,/No graph available/);
  assert.match(result.markdown,/No source citation|Captured file inventory/);
});
test('API errors preserve safe server messages and handle HTML outages without raw response leakage',async()=>{
  assert.deepEqual(await readResponse(Response.json({ok:true})),{ok:true});
  await assert.rejects(readResponse(Response.json({detail:'Source may already be removed; retry.'},{status:503})),/retry/);
  await assert.rejects(readResponse(new Response('<html>private internals</html>',{status:502})),error=>error.message.includes('unreadable') && !error.message.includes('private internals'));
  await assert.rejects(readResponse(Response.json({detail:[{msg:'schema'}]},{status:422})),/could not be completed/);
});
