/**
 * Finance intelligence smoke — no network / Firebase / RN.
 * node scripts/_finance_intelligence_smoke.js
 */

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function loadPlain(rel, names, preamble = '') {
  const abs = path.join(root, rel);
  let code = fs.readFileSync(abs, 'utf8');
  code = code.replace(/^import\s+[^;]+;/gm, '/* import stripped */');
  code = code.replace(/export\s+default\s+\{[\s\S]*?\};?\s*$/m, '');
  code = code.replace(/export\s+default\s+\w+\s*;?/g, '');
  code = code.replace(/^export\s+/gm, '');
  const assign = names.map((n) => `module.exports.${n} = ${n};`).join('\n');
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', `${preamble}\n${code}\n${assign}`)(mod, mod.exports);
  return mod.exports;
}

let passed = 0;
let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== Finance Intelligence Smoke ===\n');

const dates = `
function yearsSince(iso) {
  if (!iso) return 0;
  const t = new Date(String(iso).slice(0,10)+'T12:00:00');
  const n = new Date('2026-08-16T12:00:00');
  return Math.max(0, (n - t) / (365.25 * 86400000));
}
function daysUntil(iso) {
  if (!iso) return null;
  const t = new Date(String(iso).slice(0,10)+'T12:00:00');
  const n = new Date('2026-08-16T12:00:00');
  return Math.round((t - n) / 86400000);
}
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
`;

const constants = loadPlain('src/services/finance/financeConstants.js', [
  'CURRENCY_INR',
  'VALUE_SOURCE',
  'DEPRECIATION_METHOD',
  'EXPENSE_BUCKET',
  'REPAIR_ADVICE',
  'formatInr',
]);
ok('INR default', constants.CURRENCY_INR === 'INR');
ok('formatInr', constants.formatInr(1850) === '₹1,850');

const val = loadPlain(
  'src/services/finance/valuationEngine.js',
  [
    'resolvePurchasePrice',
    'calculateConfigurableDepreciation',
    'resolveCurrentEstimatedValue',
    'calculateAssetAge',
  ],
  `
  ${dates}
  const VALUE_SOURCE = ${JSON.stringify(constants.VALUE_SOURCE)};
  const DEPRECIATION_METHOD = ${JSON.stringify(constants.DEPRECIATION_METHOD)};
  const CURRENCY_INR = 'INR';
  function calculateResaleValue({ purchaseValue }) {
    return { estimatedResale: Math.round(purchaseValue * 0.7) };
  }
  function calculateDepreciation({ purchaseValue, purchaseDate }) {
    const age = yearsSince(purchaseDate);
    const book = Math.round(purchaseValue * Math.max(0.1, 1 - 0.15 * age));
    return { bookValue: book, accumulatedDepreciation: purchaseValue - book, ageYears: age };
  }
  `,
);

ok('missing purchase', val.resolvePurchasePrice({}).available === false);
ok('purchase 42000', val.resolvePurchasePrice({ purchasePrice: 42000 }).value === 42000);
ok('age 3 years', val.calculateAssetAge({ purchaseDate: '2023-08-15' }).years === 3);
ok('future purchase invalid', val.calculateAssetAge({ purchaseDate: '2027-01-01' }).available === false);
ok(
  'straight line estimate',
  val.calculateConfigurableDepreciation(
    { purchasePrice: 60000, purchaseDate: '2021-08-16', usefulLifeYears: 5 },
    { method: 'STRAIGHT_LINE' },
  ).isEstimate === true,
);
ok(
  'user value source',
  val.resolveCurrentEstimatedValue({
    currentEstimatedValue: 15000,
    valueSource: 'USER_ENTERED',
  }).label === 'Estimated Current Value',
);

const own = loadPlain(
  'src/services/finance/ownershipCostEngine.js',
  [
    'categorizeExpenseRow',
    'sumExpenseBuckets',
    'computeAssetOwnershipCost',
    'computeCostPerPeriod',
    'evaluateRepairVsReplace',
    'summarizeRepairFrequency',
  ],
  `
  ${dates}
  const CURRENCY_INR = 'INR';
  const REPAIR_ADVICE = ${JSON.stringify(constants.REPAIR_ADVICE)};
  const EXPENSE_BUCKET = ${JSON.stringify(constants.EXPENSE_BUCKET)};
  const VALUE_SOURCE = ${JSON.stringify(constants.VALUE_SOURCE)};
  const DEPRECIATION_METHOD = ${JSON.stringify(constants.DEPRECIATION_METHOD)};
  function computeOwnershipCost(asset, opts={}) {
    const purchase = Number(asset.purchasePrice||asset.value||0)||0;
    return { purchase, totalOwnershipCost: purchase + (opts.serviceCost||0) + (opts.repairCost||0) };
  }
  const baseOwnership = computeOwnershipCost;
  function repairVsReplaceInsight(){ return null; }
  function resolvePurchasePrice(a){ return (${val.resolvePurchasePrice.toString()})(a); }
  function resolveCurrentEstimatedValue(a){ return (${val.resolveCurrentEstimatedValue.toString()})(a); }
  function calculateAssetAge(a,n){ return (${val.calculateAssetAge.toString()})(a,n); }
  function calculateResaleValue({ purchaseValue }) { return { estimatedResale: Math.round(purchaseValue * 0.7) }; }
  function calculateDepreciation({ purchaseValue }) { return { bookValue: purchaseValue, accumulatedDepreciation: 0, ageYears: 1 }; }
  function calculateConfigurableDepreciation(){ return { available: true, bookValue: 10000 }; }
  `,
);

const bikeOwn = own.computeAssetOwnershipCost(
  { purchasePrice: 120000, currencyCode: 'INR' },
  { serviceCost: 12000, insuranceCost: 18000, repairCost: 7500, accessoriesCost: 8000 },
);
ok('bike ownership 165500', bikeOwn.totalOwnershipCost === 165500);
ok('no invent purchase', own.computeAssetOwnershipCost({}).purchaseAvailable === false);

const buckets = own.sumExpenseBuckets([
  { category: 'service', costInr: 1200 },
  { category: 'repair', costInr: 3500 },
]);
ok('expense buckets', buckets.service === 1200 && buckets.repair === 3500);

const advice = own.evaluateRepairVsReplace(
  { purchasePrice: 40000, currentEstimatedValue: 20000 },
  { repairCost: 18000, repairCount: 4 },
);
ok('compare replacement advice', advice.advice === 'COMPARE_REPLACEMENT');
ok('soft language', /Consider comparing/.test(advice.message));
ok('never Replace it', !/Replace it/i.test(advice.message));

const freq = own.summarizeRepairFrequency([
  { category: 'repair', costInr: 1000, repairDate: '2026-01-01' },
  { category: 'repair', costInr: 1000, repairDate: '2026-03-01' },
  { category: 'repair', costInr: 1000, repairDate: '2026-06-01' },
  { category: 'repair', costInr: 1000, repairDate: '2026-07-01' },
]);
ok('4 repairs message', freq.numberOfRepairs === 4 && /4/.test(freq.message));

const comp = loadPlain('src/services/finance/completenessScore.js', [
  'computeProfileCompleteness',
]);
const incomplete = comp.computeProfileCompleteness({ assetName: 'Bike' });
ok('completeness < 100', incomplete.percent < 100 && incomplete.missing.length > 0);
ok('completeness note', /not Asset Health/i.test(incomplete.note));

const complete = comp.computeProfileCompleteness({
  assetName: 'Bike',
  nickname: 'Garage Bike',
  purchaseDate: '2024-01-01',
  purchasePrice: 100000,
  registration: 'UP32AB1234',
  hasBill: true,
  categoryId: 'bike',
  insuranceExpiry: '2027-01-01',
  pucExpiry: '2027-01-01',
});
ok('vehicle completeness high', complete.percent >= 80);

// Portfolio aggregation with stubs
const portfolioPreamble = `
  ${dates}
  const CURRENCY_INR = 'INR';
  function formatInr(n){ return '₹' + Math.round(Number(n)||0).toLocaleString('en-IN'); }
  function getAssetFolderType(asset){
    const id = String(asset.categoryId||'').toLowerCase();
    if (['car','bike','scooter','ev'].includes(id)) return 'vehicle';
    if (['ac','fridge'].includes(id)) return 'appliances';
    if (['mobile','laptop'].includes(id)) return 'gadgets';
    return 'other';
  }
  function computePortfolioHealth(list){
    return { score: 84, band: 'Good', count: list.length, healthy: 1, needsAttention: 1, critical: 0 };
  }
  function resolvePurchasePrice(a){ return (${val.resolvePurchasePrice.toString()})(a); }
  function resolveCurrentEstimatedValue(a){
    if (a.currentEstimatedValue!=null) return { available:true, value:Number(a.currentEstimatedValue), label:'Estimated Current Value' };
    if (a.purchasePrice) return { available:true, value:Math.round(a.purchasePrice*0.7), label:'Estimated Current Value' };
    return { available:false, value:null, label:'Estimate unavailable' };
  }
  function calculateAssetAge(a){ return (${val.calculateAssetAge.toString()})(a); }
  function computeAssetOwnershipCost(asset){
    const p = Number(asset.purchasePrice||0)||0;
    const s = Number(asset.serviceCostTotal||0)||0;
    const r = Number(asset.repairCostTotal||0)||0;
    return { purchase:p, purchaseAvailable:p>0, service:s, repair:r, insurance:0, energy:0, accessories:0, other:0, fuel:0, charging:0, totalOwnershipCost:p+s+r, label:'Total Ownership Cost' };
  }
  function computeCostPerPeriod(){ return { available:false }; }
  function computeProfileCompleteness(){ return { percent: 70, missing: [] }; }
  function buildEnergyCostDashboard(assets){
    const acs = assets.filter(a=>a.categoryId==='ac').map(a=>({
      assetId:a.assetId, name:a.nickname||a.assetName,
      monthlyCost:a.energyProfile?.estimatedMonthlyCost||0,
      monthlyKwh:a.energyProfile?.estimatedMonthlyConsumptionKwh||0,
    })).sort((a,b)=>b.monthlyCost-a.monthlyCost);
    return {
      isEstimate:true,
      household:{ byAsset:[], estimatedMonthlyCost:0 },
      acDashboard:{ rows:acs, totalMonthlyCost:acs.reduce((s,r)=>s+r.monthlyCost,0), highest:acs[0]||null, lowest:acs[acs.length-1]||null },
      comparisonMessage: acs[0]? acs[0].name+' has the highest estimated consumption.':null,
    };
  }
`;

const pf = loadPlain(
  'src/services/finance/portfolioFinance.js',
  ['buildPortfolioFinance', 'buildAssetFinanceSnapshot', 'detectExpenseAnomaly'],
  portfolioPreamble,
);

const assets = [
  {
    assetId: 'b1',
    categoryId: 'bike',
    assetName: 'Garage Bike',
    purchasePrice: 120000,
    purchaseDate: '2024-01-01',
    serviceCostTotal: 12000,
    repairCostTotal: 7500,
  },
  {
    assetId: 'a1',
    categoryId: 'ac',
    nickname: 'Master Bedroom AC',
    purchasePrice: 42000,
    purchaseDate: '2022-01-01',
    energyProfile: { estimatedMonthlyCost: 1250, estimatedMonthlyConsumptionKwh: 145 },
  },
  {
    assetId: 'a2',
    categoryId: 'ac',
    nickname: 'Living Room AC',
    purchasePrice: 45000,
    purchaseDate: '2022-06-01',
    energyProfile: { estimatedMonthlyCost: 1650, estimatedMonthlyConsumptionKwh: 175 },
  },
];

const port = pf.buildPortfolioFinance(assets);
ok('portfolio asset count 3', port.totalAssets === 3);
ok('purchase sum', port.purchaseValue === 120000 + 42000 + 45000);
ok('current is estimate labeled', port.currentLabel === 'Estimated Current Value' && port.currentIsEstimate);
ok('ownership includes purchases', port.totalOwnershipCost >= port.purchaseValue);
ok('category breakdown', port.byCategory.length >= 2);
ok('AC highest living room', /Living Room/.test(port.energy.comparisonMessage || ''));

const anomaly = pf.detectExpenseAnomaly(14500, 8500);
ok('expense anomaly', anomaly && anomaly.changePercent > 25);

// Empty / edge
ok('empty portfolio', pf.buildPortfolioFinance([]).totalAssets === 0);
ok('zero value asset', pf.buildAssetFinanceSnapshot({ assetName: 'X' }).purchase.available === false);

const query = loadPlain(
  'src/services/finance/financeQuery.js',
  ['queryPortfolioFinance', 'FINANCE_QUERY_INTENTS'],
  `
  ${portfolioPreamble}
  function buildPortfolioFinance(a,o){ return (${pf.buildPortfolioFinance.toString()})(a,o); }
  function buildAssetFinanceSnapshot(a,o){ return (${pf.buildAssetFinanceSnapshot.toString()})(a,o); }
  function buildEnergyCostDashboard(a,o){ return (${pf.buildEnergyCostDashboard ? 'null' : 'null'}); }
  `,
);

// Direct energy + query using portfolio helpers already tested
ok('query intents listed', Array.isArray(query.FINANCE_QUERY_INTENTS) && query.FINANCE_QUERY_INTENTS.length >= 5);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
