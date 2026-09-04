import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, comparePair, normalizeIpt, normalizeTickets } from '../src/index.mjs';

const ipt = normalizeIpt({
  id: 867, name: 'Dospělý, 30 minut, Praha', type: 'adult', price: '35.00', vatRate: 12,
  validDuration: 30, durationType: 1, validZones: 'P,0,B', validZoneCount: 3,
  excludedZones: '', excludesTrains: false, cptp: 101, pricingType: 1, isCapAble: false,
  availableSince: '2026-01-01', availableUntil: '2030-01-01'
});

function ticket(overrides = {}) {
  return normalizeTickets({
    productId: 1002, title: { cs: 'Dospělý, 30 minut, Praha' }, productSubTypeCode: 'adult',
    productType: 'ADMISSION_SINGLE', price: { amount: 35 }, vatRate: 12, duration: 30,
    durationType: 'FROM_ACTIVATION', zones: ['B', '0', 'P'], zoneCount: 3, excludedZones: [],
    excludesTrains: false, cptp: 101, pricingType: 'NORMAL', isCapAble: false,
    availableSince: '2026-01-01', availableUntil: '2030-01-01', state: 'PUBLISHED',
    fulfillmentMediaTypes: ['Wallet'], ...overrides
  });
}

test('same tariff with an older price remains activation compatible', () => {
  const result = comparePair(ipt, ticket({ price: { amount: 30 } }));
  assert.equal(result.activationVerdict, 'WARNING');
  assert.equal(result.purchaseVerdict, 'MISMATCH');
  assert.equal(result.comparisons.find(x => x.field === 'price').activationResult, 'WARNING');
});

test('a changed tariff is rejected for activation', () => {
  const result = comparePair(ipt, ticket({ duration: 90 }));
  assert.equal(result.activationVerdict, 'MISMATCH');
});

test('a field without a counterpart warns but does not block either use case', () => {
  const result = comparePair(ipt, ticket({ cptp: undefined }));
  assert.equal(result.activationVerdict, 'WARNING');
  assert.equal(result.purchaseVerdict, 'WARNING');
  assert.equal(result.comparisons.find(x => x.field === 'cptp').rawResult, 'NO_COUNTERPART');
});

test('VAT, excluded zones and sale dates warn but do not create a mismatch', () => {
  const result = comparePair(ipt, ticket({
    vatRate: 10,
    excludedZones: ['13'],
    availableSince: '2020-01-01',
    availableUntil: '2099-12-31'
  }));
  assert.equal(result.activationVerdict, 'WARNING');
  assert.equal(result.purchaseVerdict, 'WARNING');
  for (const field of ['vatRate', 'excludedZones', 'availableSince', 'availableUntil']) {
    const comparison = result.comparisons.find(x => x.field === field);
    assert.equal(comparison.activationResult, 'WARNING');
    assert.equal(comparison.purchaseResult, 'WARNING');
  }
});

test('different system-specific names are informational only', () => {
  const result = comparePair(ipt, ticket({ title: { cs: 'Jiný zobrazovaný název' } }));
  assert.equal(result.activationVerdict, 'MATCH');
  assert.equal(result.purchaseVerdict, 'MATCH');
  assert.equal(result.comparisons.find(x => x.field === 'name').activationResult, 'INFO');
});

test('capping eligibility is a warning for both use cases', () => {
  const result = comparePair(ipt, ticket({ isCapAble: true }));
  assert.equal(result.activationVerdict, 'WARNING');
  assert.equal(result.purchaseVerdict, 'WARNING');
  assert.equal(result.comparisons.find(x => x.field === 'isCapAble').activationResult, 'WARNING');
});

test('IPT zones being a subset of Tickets zones is a non-blocking warning', () => {
  const result = comparePair(ipt, ticket({ zones: ['P', '0', 'B', '1'] }));
  const comparison = result.comparisons.find(x => x.field === 'zones');
  assert.equal(comparison.rawResult, 'IPT_SUBSET_OF_TICKETS');
  assert.equal(comparison.activationResult, 'WARNING');
  assert.equal(result.activationVerdict, 'WARNING');
});

test('Tickets zones missing a zone required by IPT is blocking', () => {
  const result = comparePair(ipt, ticket({ zones: ['P', '0'] }));
  assert.equal(result.comparisons.find(x => x.field === 'zones').activationResult, 'MISMATCH');
  assert.equal(result.activationVerdict, 'MISMATCH');
  assert.equal(result.purchaseVerdict, 'MISMATCH');
});

test('incomplete mapping is accepted and reported', () => {
  const report = buildReport([ipt.raw, { ...ipt.raw, id: 868 }], { items: [ticket().raw] }, [
    { iptProductId: '867', ticketsProductId: '1002', usage: 'BOTH', status: 'PROPOSED', note: '' }
  ]);
  assert.equal(report.summary.mappedProducts, 1);
  assert.equal(report.summary.unmapped, 1);
});

test('one IPT product can point to multiple historical activation products', () => {
  const old = ticket({ productId: 1001, price: { amount: 30 }, state: 'DISABLED' });
  const current = ticket();
  const report = buildReport([ipt.raw], { items: [old.raw, current.raw] }, [
    { iptProductId: '867', ticketsProductId: '1001', usage: 'ACTIVATE_EXISTING', status: 'CONFIRMED' },
    { iptProductId: '867', ticketsProductId: '1002', usage: 'BOTH', status: 'CONFIRMED' }
  ]);
  assert.equal(report.summary.mappedProducts, 1);
  assert.equal(report.summary.mappedPairs, 2);
  assert.equal(report.products[0].pairs[0].pair.activationVerdict, 'WARNING');
});

test('a human rejection overrides an otherwise usable candidate', () => {
  const report = buildReport([ipt.raw], { items: [ticket().raw] }, [
    { iptProductId: '867', ticketsProductId: '1002', usage: 'BOTH', status: 'PROPOSED', humanDecision: 'REJECTED' }
  ]);
  const pair = report.products[0].pairs[0].pair;
  assert.equal(pair.automaticActivationVerdict, 'MATCH');
  assert.equal(pair.activationVerdict, 'MISMATCH');
  assert.equal(pair.purchaseVerdict, 'MISMATCH');
  assert.equal(pair.humanDecision, 'REJECTED');
  assert.equal(report.summary.humanRejected, 1);
});
