const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pack=JSON.parse(fs.readFileSync(path.join(root,'public/scenarios/pidlitacka/task-1289-capping-int-regular.json')));

test('active INT capping pack uses regular tariffs after synthetic fixtures are retired',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/scenarios/pidlitacka/index.json')));
 assert.ok(manifest.packs.some(p=>p.file==='task-1289-capping-int-regular.json'));
 assert.ok(!manifest.packs.some(p=>p.id==='pidlitacka-task-1289-capping-int'));
 assert.equal(pack.scenarios.length,3);
 assert.ok(!/128900[1-8]/.test(JSON.stringify(pack)));
 const ids=pack.scenarios.flatMap(s=>s.steps.filter(st=>st.id.startsWith('offer')).map(st=>st.request?.body?.productId)).filter(Boolean);
 assert.deepEqual([...new Set(ids)].sort((a,b)=>a-b),[867,868,898,899]);
 for(const s of pack.scenarios){assert.equal(s.requiredEnvironment.environmentId,'pidlitacka-integration');assert.equal(s.requiredEnvironment.targetBaseUrl,'https://pidl2-backend.int.pidlitacka.cz');assert.equal(s.smoke,false);assert.equal(s.manualInputRequired,true);}
});

test('regular top-up flows pin each category price, target and both consumed sources',()=>{
 for(const [kind,paid,topup,target]of [['adult',82,58,883],['senior',41,29,901]]){
  const s=pack.scenarios.find(s=>s.id.endsWith('-'+kind)),get=id=>s.steps.find(st=>st.id===id);
  assert.equal(get('source-booking').request.body.offerIds.length,2);
  assert.ok(get('source-booking').expected.assertions.some(a=>a.path==='$.provisionalPrice.amount'&&a.equals===paid));
  assert.ok(get('below-threshold').expected.assertions.some(a=>a.path==='$.offerAvailability'&&a.equals==='none'));
  assert.equal(get('topup').request.body.expectedAmount,topup);
  assert.ok(get('replacement').expected.assertions.some(a=>a.path==='$.fulfillments[0].productId'&&a.equals===target));
  assert.ok(get('source-history').expected.assertions.some(a=>a.path==='$.fulfillments[1].cappedByFulfillmentId'));
 }
});

test('automatic cap crosses real 140 CZK threshold with four non-overlapping 30-minute tickets',()=>{
 const s=pack.scenarios.find(s=>s.id.endsWith('-auto'));
 assert.equal(s.steps.find(st=>st.id==='offer').request.body.amount,4);
 const activations=s.steps.filter(st=>st.request?.method==='PATCH');assert.equal(activations.length,4);
 const minutes=activations.map(st=>Number(st.request.body.validSince.match(/nowPlusMinutes:(\d+)/)[1]));
 for(let i=1;i<minutes.length;i++)assert.ok(minutes[i]-minutes[i-1]>=30);
 assert.ok(s.steps.find(st=>st.id==='auto-wait').expected.warnings.some(w=>w.blockAdvance&&w.autoRetry));
 assert.equal(s.steps.filter(st=>st.request?.path.endsWith('/card/initiate')).length,1);
 assert.ok(s.steps.find(st=>st.id==='auto-capped').expected.assertions.some(a=>a.path==='$.days[0].series[0].dailyPrice.amount'&&a.equals===140));
 assert.ok(s.steps.find(st=>st.id==='auto-capped').expected.assertions.some(a=>a.path==='$.days[0].series[0].targetProductId'&&a.equals===883));
 assert.ok(s.steps.find(st=>st.id==='auto-capped').expected.assertions.some(a=>a.path==='$.days[0].series[0].paidContribution.amount'&&a.equals===144));
 for(let i=0;i<4;i++)assert.ok(s.steps.find(st=>st.id==='source-pieces').expected.assertions.some(a=>a.path===`$.fulfillments[${i}].productId`&&a.equals===867));
});
