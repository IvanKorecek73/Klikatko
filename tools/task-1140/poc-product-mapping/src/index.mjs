import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

export const DEFAULTS = {
  ipt: path.resolve(projectRoot, '../podklady/ipt-mds-prod-products.json'),
  tickets: path.resolve(projectRoot, '../podklady/tickets-int-products.json'),
  mapping: path.resolve(projectRoot, 'mapping.csv'),
  out: path.resolve(projectRoot, 'report')
};

const durationTypes = new Map([
  [1, 'FROM_ACTIVATION'],
  [2, 'FROM_NEXT_MIDNIGHT']
]);

const passengerTypes = new Map([
  ['adult', 'adult'],
  ['reduced', 'discounted'],
  ['senior', 'senior'],
  ['disabled', 'ztp'],
  ['bag', 'luggage'],
  ['dog', 'luggage'],
  ['bike', 'bike'],
  ['group_3', 'group'],
  ['group_6', 'group']
]);

const activationFields = [
  'passengerType', 'duration', 'durationType', 'zones', 'zoneCount',
  'excludesTrains', 'cptp', 'pricingType'
];
const purchaseFields = [...activationFields, 'price', 'isCurrentlySold'];
const warningFields = ['price', 'vatRate', 'excludedZones', 'availableSince', 'availableUntil', 'isCapAble'];
const infoFields = ['name'];

function args(argv) {
  const result = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (['--ipt', '--tickets', '--mapping', '--out'].includes(key)) {
      if (!argv[i + 1]) throw new Error(`Missing value for ${key}`);
      result[key.slice(2)] = path.resolve(argv[++i]);
    } else if (key === '--strict') result.strict = true;
    else throw new Error(`Unknown argument: ${key}`);
  }
  return result;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function items(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  throw new Error('Expected a JSON array or an object with an items array.');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some(x => x.length)) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift();
  return rows.map(values => Object.fromEntries(header.map((h, i) => [h, values[i] ?? ''])));
}

function zones(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(list.map(x => String(x).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'cs', { numeric: true }));
}

function isoDate(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : String(value);
}

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeIpt(p, today = new Date().toISOString().slice(0, 10)) {
  const availableSince = isoDate(p.availableSince);
  const availableUntil = isoDate(p.availableUntil);
  return {
    id: number(p.id),
    name: p.name ?? null,
    passengerType: passengerTypes.get(p.type) ?? p.type ?? null,
    sourceType: p.type ?? null,
    price: number(p.price),
    vatRate: number(p.vatRate),
    duration: number(p.validDuration),
    durationType: durationTypes.get(number(p.durationType)) ?? String(p.durationType ?? ''),
    zones: zones(p.validZones),
    zoneCount: number(p.validZoneCount),
    excludedZones: zones(p.excludedZones),
    excludesTrains: p.excludesTrains ?? null,
    cptp: number(p.cptp),
    pricingType: number(p.pricingType) === 1 ? 'NORMAL' : String(p.pricingType ?? ''),
    isCapAble: p.isCapAble ?? null,
    availableSince,
    availableUntil,
    isCurrentlySold: (!availableSince || availableSince <= today) && (!availableUntil || availableUntil >= today),
    raw: p
  };
}

export function normalizeTickets(p, today = new Date().toISOString().slice(0, 10)) {
  const availableSince = isoDate(p.availableSince);
  const availableUntil = isoDate(p.availableUntil);
  const excluded = p.excludedZones ?? (p.excludedZoneDetails ?? []).map(x => x.id);
  return {
    id: number(p.productId),
    name: p.title?.cs ?? p.title?.en ?? null,
    passengerType: p.productSubTypeCode ?? null,
    productType: p.productType ?? null,
    price: number(p.price?.amount),
    vatRate: number(p.vatRate ?? p.price?.vat?.percentage),
    duration: number(p.duration),
    durationType: p.durationType ?? null,
    zones: zones(p.zones),
    zoneCount: number(p.zoneCount),
    excludedZones: zones(excluded),
    excludesTrains: p.excludesTrains ?? null,
    cptp: number(p.cptp),
    pricingType: p.pricingType ?? null,
    isCapAble: p.isCapAble ?? null,
    availableSince,
    availableUntil,
    state: p.state ?? null,
    fulfillmentMediaTypes: p.fulfillmentMediaTypes ?? null,
    isCurrentlySold: p.state === 'PUBLISHED' && (!availableSince || availableSince <= today) && (!availableUntil || availableUntil >= today),
    raw: p
  };
}

function equal(a, b) {
  if (Array.isArray(a) || Array.isArray(b))
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return a === b;
}

function contextualResult(field, rawResult, requiredFields) {
  if (rawResult === 'MATCH') return 'MATCH';
  if (rawResult === 'IPT_SUBSET_OF_TICKETS' || rawResult === 'NO_COUNTERPART') return 'WARNING';
  if (requiredFields.includes(field)) return 'MISMATCH';
  if (infoFields.includes(field)) return 'INFO';
  return 'WARNING';
}

function compareField(field, ipt, tickets) {
  const left = ipt[field];
  const right = tickets[field];
  const missingLeft = left === null || left === undefined;
  const missingRight = right === null || right === undefined;
  let rawResult;
  if (missingLeft || missingRight) rawResult = 'NO_COUNTERPART';
  else if (equal(left, right)) rawResult = 'MATCH';
  else if (field === 'zones' && Array.isArray(left) && Array.isArray(right) && left.every(zone => right.includes(zone))) rawResult = 'IPT_SUBSET_OF_TICKETS';
  else rawResult = 'DIFFERENT';
  return {
    field,
    ipt: left ?? null,
    tickets: right ?? null,
    rawResult,
    activationResult: contextualResult(field, rawResult, activationFields),
    purchaseResult: contextualResult(field, rawResult, purchaseFields)
  };
}

function verdict(comparisons, context) {
  const key = `${context}Result`;
  if (comparisons.some(x => x[key] === 'MISMATCH')) return 'MISMATCH';
  if (comparisons.some(x => x[key] === 'NO_COUNTERPART')) return 'REVIEW';
  if (comparisons.some(x => x[key] === 'WARNING')) return 'WARNING';
  return 'MATCH';
}

export function comparePair(ipt, tickets) {
  const fields = [...new Set([...purchaseFields, ...warningFields, ...infoFields])];
  const comparisons = fields.map(field => compareField(field, ipt, tickets));
  return {
    iptProductId: ipt.id,
    ticketsProductId: tickets.id,
    activationVerdict: verdict(comparisons, 'activation'),
    purchaseVerdict: verdict(comparisons, 'purchase'),
    comparisons,
    iptRaw: ipt.raw,
    ticketsRaw: tickets.raw
  };
}

function candidateScore(ipt, tickets) {
  const weights = {
    passengerType: 30, duration: 22, durationType: 10, zoneCount: 10,
    zones: 10, price: 8, pricingType: 2, excludesTrains: 2
  };
  let score = 0, possible = 0;
  for (const [field, weight] of Object.entries(weights)) {
    const a = ipt[field], b = tickets[field];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    possible += weight;
    if (equal(a, b)) score += weight;
  }
  return { score, possible, percentage: possible ? Math.round(score * 100 / possible) : 0 };
}

function candidatesFor(ipt, allTickets) {
  return allTickets.map(tickets => ({ tickets, ...candidateScore(ipt, tickets) }))
    .sort((a, b) => b.percentage - a.percentage || b.score - a.score || a.tickets.id - b.tickets.id)
    .slice(0, 5)
    .map(x => ({ ticketsProductId: x.tickets.id, name: x.tickets.name, score: x.score, possible: x.possible, percentage: x.percentage }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function display(value) {
  if (Array.isArray(value)) return value.join(', ') || '∅';
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function isUsable(verdict) {
  return verdict === 'MATCH' || verdict === 'WARNING';
}

function applyHumanDecision(pair, mapping) {
  const humanDecision = String(mapping.humanDecision || 'UNDECIDED').trim().toUpperCase();
  return {
    ...pair,
    automaticActivationVerdict: pair.activationVerdict,
    automaticPurchaseVerdict: pair.purchaseVerdict,
    humanDecision,
    activationVerdict: humanDecision === 'REJECTED' ? 'MISMATCH' : pair.activationVerdict,
    purchaseVerdict: humanDecision === 'REJECTED' ? 'MISMATCH' : pair.purchaseVerdict
  };
}

function html(report) {
  const cards = report.products.map(item => {
    const shownPairs = item.pairs.length ? item.pairs.map(x => ({ ...x, suggested: false })) : item.suggestedPair ? [{ pair: item.suggestedPair, mapping: null, suggested: true }] : [];
    const activationUsable = item.pairs.length > 0 && item.pairs.some(x => isUsable(x.pair.activationVerdict));
    const humanRejected = item.pairs.length > 0 && item.pairs.some(x => x.pair.humanDecision === 'REJECTED');
    const badge = item.pairs.length ? item.pairs.map(x => `T${x.pair.ticketsProductId}: aktivace ${isUsable(x.pair.activationVerdict) ? 'POUŽITELNÁ' : 'NEPOUŽITELNÁ'}, nákup ${isUsable(x.pair.purchaseVerdict) ? 'POUŽITELNÝ' : 'NEPOUŽITELNÝ'}${x.pair.humanDecision === 'REJECTED' ? ', LIDSKY ZAMÍTNUTO' : ''}`).join(' · ') : 'UNMAPPED — zobrazen nejlepší kandidát';
    const cls = activationUsable ? 'usable' : humanRejected ? 'rejected' : 'unusable';
    const suggestions = item.candidates.map(c => `${c.ticketsProductId} (${c.percentage} %) ${escapeHtml(c.name)}`).join('<br>');
    const pairBlocks = shownPairs.map(({ pair, mapping, suggested }) => {
      const comparisons = pair.comparisons.map(c => {
        const activationClass = `status-${c.activationResult.toLowerCase()}`;
        const purchaseClass = `status-${c.purchaseResult.toLowerCase()}`;
        const suffix = c.rawResult === 'IPT_SUBSET_OF_TICKETS' ? ' — IPT ⊂ Tickets' : '';
        return `<tr><td>${escapeHtml(c.field)}</td><td>${escapeHtml(display(c.ipt))}</td><td>${escapeHtml(display(c.tickets))}</td><td class="${activationClass}">${c.activationResult}${suffix}</td><td class="${purchaseClass}">${c.purchaseResult}${suffix}</td></tr>`;
      }).join('');
      const humanDecision = pair.humanDecision ?? 'UNDECIDED';
      const rejected = humanDecision === 'REJECTED';
      const approved = humanDecision === 'APPROVED';
      const decisionLabel = rejected ? 'ZAMÍTNUTO' : approved ? 'SCHVÁLENO' : 'NEROZHODNUTO';
      const decisionClass = rejected ? 'status-mismatch' : approved ? 'status-match' : 'status-info';
      const decisionResult = rejected ? 'MISMATCH — lidské rozhodnutí' : approved ? 'MATCH — lidské rozhodnutí' : 'INFO';
      const decisionRow = `<tr><td>humanDecision</td><td colspan="2">${decisionLabel}</td><td class="${decisionClass}">${decisionResult}</td><td class="${decisionClass}">${decisionResult}</td></tr>`;
      const automaticNote = rejected ? ` · Automaticky: aktivace ${pair.automaticActivationVerdict}, nákup ${pair.automaticPurchaseVerdict}` : '';
      return `<h3>${suggested ? 'SUGGESTED' : escapeHtml(mapping.usage)}: IPT ${pair.iptProductId} → Tickets ${pair.ticketsProductId}</h3><p><span class="pill">Aktivace: ${isUsable(pair.activationVerdict) ? 'POUŽITELNÁ' : 'NEPOUŽITELNÁ'} (${pair.activationVerdict})</span> <span class="pill">Nákup: ${isUsable(pair.purchaseVerdict) ? 'POUŽITELNÝ' : 'NEPOUŽITELNÝ'} (${pair.purchaseVerdict})</span>${mapping ? ` · Stav vazby: ${escapeHtml(mapping.status)}` : ''}${automaticNote}</p><table><thead><tr><th>Parametr</th><th>IPT</th><th>Tickets</th><th>Aktivace</th><th>Nákup</th></tr></thead><tbody>${decisionRow}${comparisons}</tbody></table><details><summary>Všechna původní data</summary><div class="raw"><pre>${escapeHtml(JSON.stringify(pair.iptRaw, null, 2))}</pre><pre>${escapeHtml(JSON.stringify(pair.ticketsRaw, null, 2))}</pre></div></details>`;
    }).join('');
    return `<details class="card ${cls}" data-state="${cls}"><summary><b>IPT ${item.iptProductId}</b> — ${escapeHtml(item.name)} <span>${escapeHtml(badge)}</span></summary>
      <p><b>Ruční vazby:</b> ${item.pairs.length || 'žádné'}<br><b>Nejlepší kandidáti:</b><br>${suggestions}</p>${pairBlocks}</details>`;
  }).join('\n');
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Task #1140 — kontrola mapování</title><style>
  body{font:15px system-ui;margin:0;background:#f5f6f8;color:#20242b}main{max-width:1320px;margin:auto;padding:24px}h1{margin-bottom:6px}.meta{color:#596273}.summary{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.metric,.card{background:white;border:1px solid #d8dce3;border-radius:9px}.metric{padding:12px 18px}.toolbar{position:sticky;top:0;background:#f5f6f8;padding:10px 0;z-index:2}.card{margin:9px 0;padding:12px;border-left:9px solid}.card.usable{border-left-color:#087f3d}.card.unusable{border-left-color:#c81e1e}.card.rejected{border-left-color:#a34f00}summary{cursor:pointer}summary span{float:right;font-weight:700}.pill{display:inline-block;padding:5px 9px;border:1px solid #bcc3ce;border-radius:6px;background:#eef1f5;color:#303846;font-weight:800}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{padding:7px;border:1px solid #d8dce3;text-align:left;vertical-align:top}td.status-match{background:#d8f3df;color:#146c35}td.status-warning{background:#fff1bd;color:#765500}td.status-info{background:#dceeff;color:#15598a}td.status-mismatch{background:#ffd6d6;color:#9a1717}.raw{display:grid;grid-template-columns:1fr 1fr;gap:10px}.raw pre{overflow:auto;background:#161a22;color:#e9edf4;padding:12px;border-radius:6px}@media(max-width:800px){.raw{grid-template-columns:1fr}summary span{float:none;display:block}}
  </style></head><body><main><h1>PoC mapování IPT → Tickets</h1><div class="meta">Vygenerováno ${escapeHtml(report.generatedAt)} · IPT ${report.sources.ipt.count} produktů · Tickets ${report.sources.tickets.count} produktů</div>
  <div class="summary"><div class="metric"><b>${report.summary.mappedProducts}</b><br>IPT produktů s vazbou</div><div class="metric"><b>${report.summary.mappedPairs}</b><br>ručních vazeb</div><div class="metric"><b>${report.summary.activationUsable}</b><br>použitelných pro aktivaci</div><div class="metric"><b>${report.summary.purchaseUsable}</b><br>použitelných pro nákup</div><div class="metric"><b>${report.summary.humanRejected}</b><br>lidsky zamítnutých vazeb</div></div>
  <p><b>Levý okraj karty vyjadřuje celkový výsledek primárního UC #1007:</b> zelená = použitelná pro aktivaci i s varováními; červená = automaticky nepoužitelná kvůli rozporu srovnatelných hodnot nebo chybějícímu mapování; tmavě oranžová = kandidát byl zamítnut lidským rozhodnutím. V detailní tabulce mají položky obvyklé barvy podle závažnosti: shoda zeleně, varování žlutě, informace modře a chyba červeně. Pole bez protějšku je varování.</p>
  <div class="toolbar"><label>Aktivace #1007 <select id="filter"><option value="all">vše</option><option value="usable">použitelné</option><option value="unusable">automaticky nepoužitelné</option><option value="rejected">lidsky zamítnuté</option></select></label></div>${cards}</main><script>document.querySelector('#filter').addEventListener('change',e=>document.querySelectorAll('.card').forEach(x=>x.hidden=e.target.value!=='all'&&x.dataset.state!==e.target.value));</script></body></html>`;
}

export function buildReport(iptRaw, ticketsRaw, mappings, sourceNames = {}) {
  const ipt = items(iptRaw).map(x => normalizeIpt(x));
  const tickets = items(ticketsRaw).map(x => normalizeTickets(x));
  const iptById = new Map(ipt.map(x => [x.id, x]));
  const ticketsById = new Map(tickets.map(x => [x.id, x]));
  const mappingByIpt = new Map();
  const mappingKeys = new Set();
  const mappingErrors = [];
  for (const mapping of mappings) {
    const iptId = number(mapping.iptProductId), ticketsId = number(mapping.ticketsProductId);
    const usage = mapping.usage || 'BOTH';
    const humanDecision = String(mapping.humanDecision || 'UNDECIDED').trim().toUpperCase();
    if (!iptById.has(iptId)) mappingErrors.push(`IPT product ${mapping.iptProductId} does not exist`);
    if (!ticketsById.has(ticketsId)) mappingErrors.push(`Tickets product ${mapping.ticketsProductId} does not exist`);
    if (!['ACTIVATE_EXISTING', 'PURCHASE_NEW', 'BOTH'].includes(usage)) mappingErrors.push(`Unknown usage ${usage} for IPT product ${iptId}`);
    if (!['UNDECIDED', 'APPROVED', 'REJECTED'].includes(humanDecision)) mappingErrors.push(`Unknown human decision ${mapping.humanDecision} for IPT product ${iptId}`);
    const key = `${iptId}:${ticketsId}:${usage}`;
    if (mappingKeys.has(key)) mappingErrors.push(`Duplicate mapping ${key}`);
    mappingKeys.add(key);
    const normalized = { ...mapping, iptProductId: iptId, ticketsProductId: ticketsId, usage, humanDecision };
    mappingByIpt.set(iptId, [...(mappingByIpt.get(iptId) ?? []), normalized]);
  }
  const products = ipt.map(source => {
    const productMappings = mappingByIpt.get(source.id) ?? [];
    const candidates = candidatesFor(source, tickets);
    const pairs = productMappings.map(mapping => ({ mapping, pair: ticketsById.has(mapping.ticketsProductId) ? applyHumanDecision(comparePair(source, ticketsById.get(mapping.ticketsProductId)), mapping) : null })).filter(x => x.pair);
    const suggestedTarget = candidates[0] && ticketsById.get(candidates[0].ticketsProductId);
    return {
      iptProductId: source.id,
      name: source.name,
      pairs,
      suggestedPair: suggestedTarget ? comparePair(source, suggestedTarget) : null,
      candidates
    };
  });
  const pairs = products.flatMap(x => x.pairs.map(y => y.pair));
  const count = (kind, value) => pairs.filter(x => x[kind] === value).length;
  return {
    generatedAt: new Date().toISOString(),
    policy: { activationFields, purchaseFields, warningFields, infoFields, humanDecisions: ['UNDECIDED', 'APPROVED', 'REJECTED'], note: 'A missing counterpart is always a warning. VAT, excluded zones, capping eligibility and sale dates are warnings. IPT zones being a subset of Tickets zones is a warning; the reverse is blocking. Name is informational. Price is a warning for activation and blocking for a new purchase. A human REJECTED decision overrides both effective verdicts to MISMATCH.' },
    sources: { ipt: { file: sourceNames.ipt, count: ipt.length }, tickets: { file: sourceNames.tickets, count: tickets.length } },
    summary: {
      mappedProducts: products.filter(x => x.pairs.length).length,
      mappedPairs: pairs.length,
      unmapped: products.filter(x => !x.pairs.length).length,
      activationUsable: pairs.filter(x => isUsable(x.activationVerdict)).length,
      purchaseUsable: pairs.filter(x => isUsable(x.purchaseVerdict)).length,
      humanRejected: pairs.filter(x => x.humanDecision === 'REJECTED').length,
      activation: Object.fromEntries(['MATCH', 'WARNING', 'REVIEW', 'MISMATCH'].map(v => [v, count('activationVerdict', v)])),
      purchase: Object.fromEntries(['MATCH', 'WARNING', 'REVIEW', 'MISMATCH'].map(v => [v, count('purchaseVerdict', v)])),
      mappingErrors
    },
    products
  };
}

function suggestedCsv(report) {
  const rows = [['iptProductId', 'ticketsProductId', 'usage', 'scorePercent', 'status', 'humanDecision', 'note']];
  for (const item of report.products) {
    const best = item.candidates[0];
    rows.push([item.iptProductId, best?.ticketsProductId ?? '', 'BOTH', best?.percentage ?? '', 'PROPOSED_AUTOMATIC', 'UNDECIDED', best ? `Candidate: ${best.name}` : 'No candidate']);
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

function summaryMarkdown(report) {
  const pairs = report.products.flatMap(x => x.pairs.map(y => y.pair));
  const differences = {};
  const missing = {};
  for (const pair of pairs) for (const c of pair.comparisons) {
    if (c.rawResult === 'DIFFERENT' || c.rawResult === 'IPT_SUBSET_OF_TICKETS') differences[c.field] = (differences[c.field] ?? 0) + 1;
    if (c.rawResult === 'NO_COUNTERPART') missing[c.field] = (missing[c.field] ?? 0) + 1;
  }
  const rows = values => Object.entries(values).sort((a, b) => b[1] - a[1]).map(([field, count]) => `| \`${field}\` | ${count} |`).join('\n') || '| — | 0 |';
  const low = report.products.filter(x => x.candidates[0]?.percentage < 80).map(x => `- IPT ${x.iptProductId} (${x.name}): Tickets ${x.candidates[0]?.ticketsProductId ?? '—'}, skóre ${x.candidates[0]?.percentage ?? 0} %`).join('\n') || '- žádné';
  const ties = report.products.filter(x => x.candidates[0] && x.candidates[0].percentage === x.candidates[1]?.percentage).map(x => `- IPT ${x.iptProductId}: shodné nejlepší skóre ${x.candidates[0].percentage} % pro Tickets ${x.candidates[0].ticketsProductId} a ${x.candidates[1].ticketsProductId}`).join('\n') || '- žádné';
  return `# Souhrn PoC mapování IPT → Tickets\n\nVygenerováno: ${report.generatedAt}\n\n| Výsledek | Aktivace | Nový nákup |\n|---|---:|---:|\n| MATCH | ${report.summary.activation.MATCH} | ${report.summary.purchase.MATCH} |\n| WARNING | ${report.summary.activation.WARNING} | ${report.summary.purchase.WARNING} |\n| REVIEW | ${report.summary.activation.REVIEW} | ${report.summary.purchase.REVIEW} |\n| MISMATCH | ${report.summary.activation.MISMATCH} | ${report.summary.purchase.MISMATCH} |\n\n- IPT produktů: ${report.sources.ipt.count}\n- Tickets produktů: ${report.sources.tickets.count}\n- IPT produktů s ruční nebo vstupní vazbou: ${report.summary.mappedProducts}\n- Posouzených vazeb: ${report.summary.mappedPairs}\n- Použitelných pro aktivaci: ${report.summary.activationUsable}\n- Použitelných pro nový nákup: ${report.summary.purchaseUsable}\n- Lidsky zamítnutých vazeb: ${report.summary.humanRejected}\n- Bez vazby: ${report.summary.unmapped}\n\n## Nejčastější rozdíly\n\n| Pole | Počet vazeb |\n|---|---:|\n${rows(differences)}\n\n## Chybějící protějšky\n\n| Pole | Počet vazeb |\n|---|---:|\n${rows(missing)}\n\n## Automatické kandidáty se skóre pod 80 %\n\n${low}\n\n## Nerozhodné nejlepší skóre\n\n${ties}\n\nAutomatické skóre slouží pouze k výběru kandidáta pro ruční kontrolu. DPH, vyloučená pásma, zastropování a prodejní data jsou varování; název je informace. Pokud jsou zóny IPT podmnožinou zón Tickets, jde o varování; opačný vztah nebo jiný překryv blokuje použití. Lidské rozhodnutí REJECTED přebíjí automatické verdikty na MISMATCH.\n`;
}

function main() {
  const options = args(process.argv.slice(2));
  const mappings = parseCsv(fs.readFileSync(options.mapping, 'utf8'));
  const report = buildReport(readJson(options.ipt), readJson(options.tickets), mappings, { ipt: options.ipt, tickets: options.tickets });
  fs.mkdirSync(options.out, { recursive: true });
  fs.writeFileSync(path.join(options.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(options.out, 'report.html'), html(report));
  fs.writeFileSync(path.join(options.out, 'summary.md'), summaryMarkdown(report));
  fs.writeFileSync(path.join(options.out, 'suggested-mapping.csv'), suggestedCsv(report));
  console.log(JSON.stringify(report.summary, null, 2));
  if (options.strict && (report.summary.mappingErrors.length || report.summary.unmapped || report.summary.activation.REVIEW || report.summary.activation.MISMATCH || report.summary.purchase.REVIEW || report.summary.purchase.MISMATCH)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
