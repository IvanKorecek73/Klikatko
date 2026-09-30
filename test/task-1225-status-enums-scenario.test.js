const assert = require('node:assert/strict');
const test = require('node:test');
const {context,pack} = require('../tools/run-task-1225.cjs');

function step(name) { return pack.scenarios[0].steps.find(s=>s.id===`ticket-1225-${name}`); }
function level(name,status,body) { return context.evaluateStep(step(name),status,body).level; }

test('payment and wallet assertions reject old wire tokens and numeric enums', () => {
  for (const name of ['payment-in-progress','wallet-in-progress','card-in-progress']) {
    const expectedId='12250000-0001-4000-8000-000000000002';
    const body={paymentId:expectedId,status:'inProgress',
      booking:{bookingId:'12250000-0000-4000-8000-000000000002',status:'confirmed',paymentState:'inProgress'}};
    assert.equal(level(name,200,body),'ok');
    assert.equal(level(name,200,{...body,status:'IN_PROGRESS'}),'error');
    assert.equal(level(name,200,{...body,status:2}),'error');
    assert.equal(level(name,200,{...body,booking:{...body.booking,paymentState:'IN_PROGRESS'}}),'error');
  }
});

test('no-payment assertions distinguish missing state from null and undefined fallback', () => {
  const body={bookingId:'12250000-0000-4000-8000-000000000010',status:'confirmed'};
  assert.equal(level('booking-null',200,body),'ok');
  assert.equal(level('booking-null',200,{...body,paymentState:null}),'error');
  assert.equal(level('booking-null',200,{...body,paymentState:'undefined'}),'error');
});

test('recovery assertions reject raw upstream status and incorrect HTTP code', () => {
  const body={code:'ticket_payment_recovery_required',bookingId:'12250000-0000-4000-8000-000000000002',
    paymentId:'12250000-0001-4000-8000-000000000002',paymentStatus:'inProgress'};
  assert.equal(level('recovery-in-progress',409,body),'ok');
  assert.equal(level('recovery-in-progress',409,{...body,paymentStatus:'IN_PROGRESS'}),'error');
  assert.equal(level('recovery-in-progress',200,body),'error');
});

test('scenario blocks an incorrect proxy target before sending requests', () => {
  context.state.harnessMeta={proxyTarget:'http://127.0.0.1:5125'};
  assert.equal(context.getScenarioEnvironmentError(),'');
  context.state.harnessMeta={proxyTarget:'https://pidl2-backend.int.pidlitacka.cz'};
  assert.notEqual(context.getScenarioEnvironmentError(),'');
});
