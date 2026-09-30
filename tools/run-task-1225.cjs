const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:5096';
const pack = JSON.parse(fs.readFileSync(path.join(root, 'public/scenarios/pidlitacka/task-1225-status-enums.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const context = vm.createContext({URL, crypto:crypto.webcrypto,
  state:{currentProject:{id:'pidlitacka'},currentEnvironmentId:'pidlitacka-local-1225',
    context:{},values:{},secrets:{},dirty:false,scenario:pack.scenarios[0]},
  elements:{baseUrl:{value:'/api'}},window:{location:{origin:base}},
  requiresAuthorizationForStep:()=>false,isExternalTokenizerStep:()=>false,makeAppMessage:()=>''});
for (const name of ['getScenarioEnvironmentError','evaluateStep','evaluateExpectedWarning',
  'evaluateBodyCondition','getPath','getRegexAssertionSource','normalizeXmlPrefixes','resolveExpectedValue',
  'resolveObject','resolveRuntimeTemplateValue','resolveTemplate','randomHex','isEmpty','deepEqual',
  'containsMatchingItem','itemMatchesExpectedShape','looseScalarEqual','describeExpectedErrorBody',
  'applyExtracts','applyRemember']) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  if (!match) throw new Error(`Missing Klikatko function: ${name}`);
  vm.runInContext(match[0], context);
}
async function request(url, method='GET', headers={}, body) {
  const response = await fetch(base + url, {method,headers:{'Content-Type':'application/json',...headers},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
  const raw = await response.text();
  let json; try {json=JSON.parse(raw);} catch {json=raw;}
  return {status:response.status,contentType:response.headers.get('content-type'),
    cacheControl:response.headers.get('cache-control'),body:json};
}
async function run() {
  context.state.harnessMeta = (await request('/__harness/meta')).body;
  const environmentError = context.getScenarioEnvironmentError();
  if (environmentError) throw Error(environmentError);
  const report={task:'1225',startedAt:new Date().toISOString(),scenarioId:context.state.scenario.id,
    environment:context.state.currentEnvironmentId,proxyTarget:context.state.harnessMeta.proxyTarget,
    mode:'actual-pid-be-http-pipeline-with-synthetic-tickets-responses',steps:[]};
  for (const step of context.state.scenario.steps) {
    for (const key of step.requiresContext || [])
      if (context.isEmpty(context.state.context[key])) throw Error(`${step.id}: missing ${key}`);
    context.state.values=Object.fromEntries((step.fields||[]).map(f=>[f.name,context.resolveObject(f.value,{},step)]));
    const resolved=context.resolveObject(step.request,context.state.values,step);
    const response=await request('/api'+resolved.path,resolved.method,resolved.headers,resolved.body);
    const result=context.evaluateStep(step,response.status,response.body);
    if (result.level!=='ok') throw Error(`${step.id}: HTTP ${response.status}: ${result.messages.join(' ')}`);
    context.applyExtracts(step,response.body,response.status);
    context.applyRemember(step);
    const safeResponse=step.id==='ticket-1225-session'
      ? {...response,body:{fixture:response.body.fixture,mode:response.body.mode,beAssembly:response.body.beAssembly}}
      : response;
    report.steps.push({id:step.id,title:step.title,method:resolved.method,path:resolved.path,level:result.level,...safeResponse});
    console.log(`${step.id}: HTTP ${response.status} ${result.level}`);
  }
  report.finishedAt=new Date().toISOString(); report.passed=true;
  const out=path.join(root,'public/local/task-1225'); fs.mkdirSync(out,{recursive:true});
  const stamp=report.startedAt.replace(/[:.]/g,'-');
  const reportPath=path.join(out,`${stamp}-report.json`);
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(out,'latest-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS ${report.steps.length}/${report.steps.length}; ${reportPath}`);
  return report;
}
module.exports={context,pack,run};
if(require.main===module) run().catch(error=>{console.error(error.message);process.exitCode=1;});
