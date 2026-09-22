const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;

const root = path.resolve(__dirname, '..');
const pack = JSON.parse(fs.readFileSync(path.join(root, 'public/scenarios/pidlitacka/task-1147-active-zones-api.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
function engine(scenario) {
  const c = vm.createContext({ URL, crypto,
    state: { scenario, currentProject:{id:'pidlitacka'}, currentEnvironmentId:scenario.requiredEnvironment.environmentId,
      harnessMeta:{proxyTarget:scenario.requiredEnvironment.targetBaseUrl}, context:{task1147FulfillmentId:'chosen',task1147DeviceId:'device',task1147Etd:'*VZ:2,3,4,5*signature'},values:{},secrets:{},dirty:false },
    elements:{baseUrl:{value:'/api'}},window:{location:{origin:'http://127.0.0.1:5099'}},
    requiresAuthorizationForStep:()=>false,isExternalTokenizerStep:()=>false,makeAppMessage:()=>''
  });
  for (const name of ['getScenarioEnvironmentError','evaluateStep','getPath','getRegexAssertionSource',
    'normalizeXmlPrefixes','resolveExpectedValue','resolveObject','resolveRuntimeTemplateValue','resolveTemplate',
    'randomHex','isEmpty','deepEqual','containsMatchingItem','itemMatchesExpectedShape','looseScalarEqual',
    'describeExpectedErrorBody','getSelectionItems','selectionItemMatchesFilter']) {
    const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
    assert.ok(match, name); vm.runInContext(match[0], c);
  }
  return c;
}
const step = (s,suffix)=>s.steps.find(st=>st.id.endsWith('-'+suffix));
const zonesFor = s=>s.id.endsWith('-fixed')?['P','0','B']:['2','3','4','5'];
const productFor = s=>step(s,'precondition').expected.assertions.find(a=>a.path==='$.fulfillment.productId').equals;
function ticket(s) {
  return {fulfillmentId:'chosen',productId:productFor(s),zoneCount:4,status:'IN_PROTECTION_DELAY',
    validZones:zonesFor(s),etd:'*VZ:'+zonesFor(s).join(',')+'*signature',validSince:'2026-09-17T10:00:00Z',validUntil:'2026-09-17T10:30:00Z'};
}
function wire(st, body) {
  return st.id.endsWith('-list')?{items:[body]}:st.id.endsWith('-detail')?{fulfillment:body,rviKeys:[]}:body;
}

test('pack is registered with three local smoke scenarios and one manual INT scenario',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/scenarios/pidlitacka/index.json'),'utf8'));
  assert.equal(manifest.packs.filter(p=>p.file==='task-1147-active-zones-api.json').length,1);
  assert.equal(pack.scenarios.length,4);
  const ids=pack.scenarios.flatMap(s=>[s.id,...s.steps.map(st=>st.id)]);
  assert.equal(ids.length,new Set(ids).size);
  for(const s of pack.scenarios) {
    const remote=s.id.includes('-int-');
    assert.equal(s.requiresAuth,true);assert.equal(s.smoke,!remote);assert.equal(s.manualInputRequired,remote);
    assert.equal(s.requiredEnvironment.environmentId,remote?'pidlitacka-integration':'pidlitacka-local-aspire');
    assert.equal(s.steps.some(st=>st.request.path.includes('__harness')), !remote);
    for(const st of s.steps) {
      assert.match(st.request.path,/^(?:\/v1\/client\/tickets|\/__harness\/fixtures\/task-960)/);
      assert.doesNotMatch(st.request.path,/payment|purchase|\/api\/v1\/fulfillments|emulator/);
    }
  }
});

test('environment binding prevents local fixture or INT activation against the wrong destination',()=>{
  for(const s of pack.scenarios) {
    const c=engine(s);assert.equal(c.getScenarioEnvironmentError(),'');
    c.state.harnessMeta.proxyTarget='https://wrong.example/';
    assert.notEqual(c.getScenarioEnvironmentError(),'');
    c.state.harnessMeta.proxyTarget='';assert.notEqual(c.getScenarioEnvironmentError(),'');
  }
});

test('precondition requires the selected AVAILABLE fulfillment without preset flexible zones',()=>{
  for(const s of pack.scenarios.filter(s=>!s.id.endsWith('-fixed'))) {
    const c=engine(s), st=step(s,'precondition');
    const original={...ticket(s),status:'AVAILABLE'};
    for(const validZones of [undefined,null,[]]) {
      assert.equal(c.evaluateStep(st,200,{fulfillment:{...original,validZones}}).level,'ok');
    }
    for(const change of [{status:'FULFILLED'},{fulfillmentId:'other'},{productId:123},{zoneCount:3},{validZones:['2','3','4','5']}]) {
      assert.equal(c.evaluateStep(st,200,{fulfillment:{...original,validZones:[],...change}}).level,'error');
    }
    assert.equal(c.evaluateStep(st,200,{...original,validZones:[]}).level,'error','PID detail must be wrapped');
  }
});

test('PATCH, retry, detail and list reject empty or wrong validZones even when ETD is correct',()=>{
  for(const s of pack.scenarios) {
    const c=engine(s), original=ticket(s);c.state.context.task1147Etd=original.etd;
    for(const st of s.steps.filter(st=>/-(activate|retry|reactivate|detail|list)$/.test(st.id))) {
      assert.equal(c.evaluateStep(st,200,wire(st,original)).level,'ok',st.id);
      for(const validZones of [undefined,null,[],['2','3','4'],['1','2','3','4'],['2','3','4','5','6']]) {
        assert.equal(c.evaluateStep(st,200,wire(st,{...original,validZones})).level,'error',st.id+' must detect the original bug');
      }
      assert.equal(c.evaluateStep(st,200,wire(st,{...original,fulfillmentId:'other'})).level,'error',st.id);
      assert.equal(c.evaluateStep(st,200,wire(st,{...original,etd:'*VZ:9,10,11,12*other'})).level,'error',st.id);
    }
  }
});

test('list assertions bind zones and ETD to the same fulfillment, not a different ticket',()=>{
  const s=pack.scenarios[0],c=engine(s),st=step(s,'readback-list'), original=ticket(s);
  assert.equal(c.evaluateStep(st,200,{items:[{...original,validZones:[]},{...original,fulfillmentId:'other'}]}).level,'error');
  assert.equal(c.evaluateStep(st,200,{items:[{...original,fulfillmentId:'other'},original]}).level,'ok');
});

test('a failed selection leaves the same ticket AVAILABLE and the successful attempt reuses its key',()=>{
  for(const s of pack.scenarios.filter(s=>!s.id.endsWith('-fixed'))) {
    const c=engine(s), rejected=step(s,'invalid'), after=step(s,'after-invalid'), activate=step(s,'activate');
    assert.equal(c.evaluateStep(rejected,422,{title:'Domain error'}).level,'ok');
    assert.equal(c.evaluateStep(rejected,200,{title:'Unexpected success'}).level,'error');
    assert.equal(c.evaluateStep(after,200,{fulfillment:{...ticket(s),status:'AVAILABLE',validZones:[]}}).level,'ok');
    assert.equal(c.evaluateStep(after,200,{fulfillment:ticket(s)}).level,'error');
    assert.equal(rejected.remember.task1147ActivationKey,'{{form.idempotencyKey}}');
    assert.equal(activate.request.headers['Idempotency-Key'],'{{context.task1147ActivationKey}}');
  }
});

test('retry preserves the full signed ETD and detail supplies the registered Tickets device id',()=>{
  for(const s of pack.scenarios) {
    assert.deepEqual(step(s,'retry').request.body,step(s,'activate').request.body);
    assert.equal(step(s,'retry').request.headers['Idempotency-Key'],'{{context.task1147ActivationKey}}');
    assert.ok(step(s,'retry').expected.assertions.some(a=>a.path==='$.etd'&&a.equals==='{{context.task1147Etd}}'));
    for(const st of s.steps.filter(st=>st.id.endsWith('-detail'))) {
      assert.equal(st.request.headers['X-Device-Id'],'{{context.task1147DeviceId}}');
    }
  }
});

test('reactivation uses a fresh key and rejects a new zone selection in every response',()=>{
  const s=pack.scenarios.find(s=>s.id.endsWith('-scheduled'));
  assert.equal(step(s,'activate').request.body.validSince,'{{context.task1147ScheduledSince}}');
  const reactivate=step(s,'reactivate');
  assert.equal(reactivate.request.headers['Idempotency-Key'],'{{form.idempotencyKey}}');
  assert.equal(reactivate.fields[0].value,'{{uuid}}');
  assert.deepEqual(reactivate.request.body.zones,['3','4','5','6']);
  assert.deepEqual(reactivate.expected.assertions.find(a=>a.path==='$.validZones').equals,['2','3','4','5']);
  assert.equal(reactivate.extract.task1147Etd,'$.etd');
  assert.ok(step(s,'reactivated-detail') && step(s,'reactivated-list'));
});

test('INT selection offers only AVAILABLE four-zone product 1004 and no automatic purchase',()=>{
  const s=pack.scenarios.find(s=>s.id.includes('-int-')),c=engine(s),select=step(s,'select');
  const original={...ticket(s),status:'AVAILABLE',validZones:[]};
  const items=c.getSelectionItems(select,{items:[original,{...original,productId:1007},{...original,status:'FULFILLED'}]});
  assert.equal(items.length,1);assert.equal(items[0].fulfillmentId,'chosen');
  assert.ok(select.selection.emptyText.includes('Test zatím není proveden'));
});
