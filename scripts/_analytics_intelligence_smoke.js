/**
 * STEP 10 — Asset Analytics / Cost of Ownership / Lifecycle smoke.
 * node scripts/_analytics_intelligence_smoke.js
 * Pure Node — no Firebase / RN / network.
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

const NOW = new Date('2026-08-16T12:00:00');

console.log('\n=== Analytics Intelligence Smoke (STEP 10) ===\n');

const constants = loadPlain('src/services/finance/financeConstants.js', [
  'CURRENCY_INR',
  'VALUE_SOURCE',
  'DEPRECIATION_METHOD',
  'EXPENSE_BUCKET',
  'REPAIR_ADVICE',
  'formatInr',
]);

const rates = loadPlain('src/services/finance/depreciationRates.js', [
  'resolveUsefulLifeYears',
  'resolveAnnualDepreciationRate',
  'DEPRECIATION_USEFUL_LIFE_YEARS',
]);

ok('mobile useful life 3y', rates.resolveUsefulLifeYears({ categoryId: 'mobile' }) === 3);
ok('car useful life 8y', rates.resolveUsefulLifeYears({ categoryId: 'car' }) === 8);
ok('override useful life', rates.resolveUsefulLifeYears({ usefulLifeYears: 12 }) === 12);

const dates = `
function yearsSince(iso) {
  if (!iso) return 0;
  const t = new Date(String(iso).slice(0,10)+'T12:00:00');
  const n = new Date('2026-08-16T12:00:00');
  return Math.max(0, (n - t) / (365.25 * 86400000));
}
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
`;

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
  function resolveUsefulLifeYears(asset) {
    if (Number(asset.usefulLifeYears) > 0) return Number(asset.usefulLifeYears);
    const key = String(asset.categoryId || 'other').toLowerCase();
    const map = { mobile: 3, car: 8, bike: 7, other: 5 };
    return map[key] || 5;
  }
  function resolveAnnualDepreciationRate(asset) {
    if (Number(asset.depreciationRate) > 0) return Number(asset.depreciationRate);
    const key = String(asset.categoryId || 'other').toLowerCase();
    const map = { mobile: 0.35, car: 0.12, bike: 0.14, other: 0.15 };
    return map[key] || 0.15;
  }
  function calculateResaleValue({ purchaseValue }) {
    return { estimatedResale: Math.round(purchaseValue * 0.7) };
  }
  function calculateDepreciation({ purchaseValue, purchaseDate }) {
    const age = yearsSince(purchaseDate);
    const salvage = purchaseValue * 0.1;
    let book = purchaseValue;
    for (let i = 0; i < Math.floor(age); i++) {
      book = Math.max(salvage, book * 0.85);
    }
    book = Math.max(0, Math.round(book));
    return { bookValue: book, accumulatedDepreciation: purchaseValue - book, ageYears: age };
  }
  `,
);

const age = val.calculateAssetAge({ purchaseDate: '2023-08-15' }, NOW);
ok('age available', age.available === true);
ok('age years ~3', age.years === 3);
ok('age label has years', /year/.test(age.label));
ok('missing purchase date', val.calculateAssetAge({}).available === false);
ok('future purchase invalid', val.calculateAssetAge({ purchaseDate: '2027-01-01' }, NOW).available === false);

const sl = val.calculateConfigurableDepreciation(
  { purchasePrice: 60000, purchaseDate: '2021-08-16', categoryId: 'mobile' },
  { method: 'STRAIGHT_LINE' },
);
ok('straight-line estimate', sl.isEstimate === true && sl.available === true);
ok('depreciation floor >= 0', sl.bookValue >= 0 && sl.accumulatedDepreciation >= 0);
ok('depreciation never negative book', sl.bookValue >= 0);

ok('missing purchase no invent', val.resolvePurchasePrice({}).available === false);
ok(
  'no market invent',
  val.resolveCurrentEstimatedValue({}).available === false &&
    /unavailable/i.test(val.resolveCurrentEstimatedValue({}).label),
);

const own = loadPlain(
  'src/services/finance/ownershipCostEngine.js',
  [
    'sumExpenseBuckets',
    'computeAssetOwnershipCost',
    'computeCostPerPeriod',
    'evaluateRepairVsReplace',
    'summarizeRepairFrequency',
    'categorizeExpenseRow',
  ],
  `
  ${dates}
  const CURRENCY_INR = 'INR';
  const REPAIR_ADVICE = ${JSON.stringify(constants.REPAIR_ADVICE)};
  const EXPENSE_BUCKET = ${JSON.stringify(constants.EXPENSE_BUCKET)};
  const VALUE_SOURCE = ${JSON.stringify(constants.VALUE_SOURCE)};
  function resolvePurchasePrice(a){ return (${val.resolvePurchasePrice.toString()})(a); }
  function resolveCurrentEstimatedValue(a){ return (${val.resolveCurrentEstimatedValue.toString()})(a); }
  function calculateAssetAge(a,n){ return (${val.calculateAssetAge.toString()})(a, n || new Date('2026-08-16T12:00:00')); }
  function computeOwnershipCost(asset, opts={}) {
    const purchase = Number(asset.purchasePrice||asset.value||0)||0;
    return { purchase, totalOwnershipCost: purchase + (opts.serviceCost||0) + (opts.repairCost||0) };
  }
  const baseOwnership = computeOwnershipCost;
  function repairVsReplaceInsight(){ return null; }
  `,
);

const expenseRows = [
  { category: 'service', costInr: 2500, repairDate: '2025-09-01' },
  { category: 'repair', costInr: 8000, repairDate: '2025-11-15' },
  { category: 'repair', costInr: 4500, repairDate: '2026-03-01' },
  { category: 'insurance', costInr: 12000, repairDate: '2026-01-10' },
];

const ownership = own.computeAssetOwnershipCost(
  {
    purchasePrice: 185000,
    purchaseDate: '2022-08-16',
    categoryId: 'bike',
    ownerUid: 'u1',
  },
  { expenseRows },
);
ok('ownership uses real rows', ownership.repair === 12500 && ownership.service === 2500);
ok('ownership total recorded', ownership.totalOwnershipCost === 185000 + 2500 + 12500 + 12000);

const period = own.computeCostPerPeriod(ownership, {
  purchasePrice: 185000,
  purchaseDate: '2022-08-16',
});
ok('cost per period available', period.available === true && period.costPerMonth > 0);
ok('no div zero young asset', own.computeCostPerPeriod(ownership, {
  purchasePrice: 185000,
  purchaseDate: '2026-08-10',
}).available === true);

const life = loadPlain(
  'src/services/finance/lifecycleAnalytics.js',
  [
    'LIFECYCLE_STATUS',
    'REPLACEMENT_FLAG',
    'resolveLifecycleStatus',
    'resolveReplacementFlag',
    'buildLifecycleReport',
  ],
  `
  function calculateAssetAge(a,n){ return (${val.calculateAssetAge.toString()})(a, n || new Date('2026-08-16T12:00:00')); }
  function summarizeRepairFrequency(rows){
    const repairs = (rows||[]).filter(r=>/repair/i.test(String(r.category||'')));
    return { numberOfRepairs: repairs.length, message: repairs.length + ' repairs' };
  }
  function buildAssetTimeline(){ return []; }
  `,
);

ok('NEW under 90d', life.resolveLifecycleStatus({ purchaseDate: '2026-07-01' }) === 'NEW');
ok(
  'HIGH_MAINTENANCE 4+ repairs',
  life.resolveLifecycleStatus(
    { purchaseDate: '2024-01-01', status: 'active' },
    {
      expenseRows: [
        { category: 'repair', repairDate: '2026-01-01' },
        { category: 'repair', repairDate: '2026-02-01' },
        { category: 'repair', repairDate: '2026-03-01' },
        { category: 'repair', repairDate: '2026-04-01' },
      ],
    },
  ) === 'HIGH_MAINTENANCE',
);
ok('AGING 5y+', life.resolveLifecycleStatus({ purchaseDate: '2020-01-01' }) === 'AGING');
ok('SOLD status', life.resolveLifecycleStatus({ status: 'sold' }) === 'SOLD');
ok(
  'replacement flag review',
  life.resolveReplacementFlag(
    { assetHealthScore: 30 },
    {
      age: { years: 9 },
      repairFrequency: { last12Months: 5 },
      period: { costPerMonth: 6000 },
      repairVsReplace: { advice: 'COMPARE_REPLACEMENT' },
    },
  ) === 'REVIEW_REPLACEMENT',
);

const engine2 = loadPlain(
  'src/services/finance/assetAnalyticsEngine.js',
  [
    'buildAssetAnalytics',
    'compareAssets',
    'computeOwnershipCostScore',
    'analyzeRepairFrequency',
    'resolveHealthVsCost',
  ],
  `
  ${dates}
  const CURRENCY_INR = 'INR';
  const VALUE_SOURCE = ${JSON.stringify(constants.VALUE_SOURCE)};
  const BUCKET = ${JSON.stringify(constants.EXPENSE_BUCKET)};
  const EXPENSE_BUCKET = BUCKET;
  function formatInr(n){ return '₹' + Math.round(Number(n)||0).toLocaleString('en-IN'); }
  function resolvePurchasePrice(a){ return (${val.resolvePurchasePrice.toString()})(a); }
  function resolveCurrentEstimatedValue(a){
    if (a.currentEstimatedValue!=null) return { available:true, value:Number(a.currentEstimatedValue), label:'Estimated Current Value', valueSource:'USER_ENTERED', isEstimate:true };
    const p = resolvePurchasePrice(a);
    if (!p.available) return { available:false, value:null, label:'Estimate unavailable', valueSource:'UNKNOWN' };
    return { available:true, value:Math.round(p.value*0.7), label:'Estimated Current Value', valueSource:'ESTIMATED', isEstimate:true };
  }
  function calculateConfigurableDepreciation(a,o){
    const purchase = resolvePurchasePrice(a);
    if (!purchase.available) return { available:false, bookValue:null, accumulatedDepreciation:null, isEstimate:true, label:'Estimate unavailable' };
    const lifeYears = 5;
    const age = yearsSince(a.purchaseDate);
    const salvage = purchase.value * 0.1;
    const annual = (purchase.value - salvage) / lifeYears;
    const dep = Math.min(purchase.value - salvage, annual * age);
    const book = Math.max(salvage, purchase.value - dep);
    return { available:true, bookValue:Math.round(book), accumulatedDepreciation:Math.round(purchase.value-book), isEstimate:true, label:'Estimated' };
  }
  function calculateAssetAge(a,n){ return (${val.calculateAssetAge.toString()})(a, n || new Date('2026-08-16T12:00:00')); }
  function categorizeExpenseRow(row){ return (${own.categorizeExpenseRow.toString()})(row); }
  function sumExpenseBuckets(rows){ return (${own.sumExpenseBuckets.toString()})(rows); }
  function computeAssetOwnershipCost(asset, opts={}){
    const purchase = resolvePurchasePrice(asset);
    const fromRows = opts.expenseRows ? sumExpenseBuckets(opts.expenseRows) : null;
    const service = Number(opts.serviceCost ?? asset.serviceCostTotal ?? fromRows?.service) || 0;
    const repair = Number(opts.repairCost ?? asset.repairCostTotal ?? fromRows?.repair) || 0;
    const insurance = Number(opts.insuranceCost ?? asset.insurancePremiumTotal ?? fromRows?.insurance) || 0;
    const accessories = Number(opts.accessoriesCost ?? asset.accessoriesCostTotal ?? fromRows?.accessories) || 0;
    const energy = Number(opts.energyCost ?? asset.energyCostTotal ?? fromRows?.energy) || 0;
    const fuel = Number(opts.fuelCost ?? asset.fuelCostTotal ?? fromRows?.fuel) || 0;
    const charging = Number(opts.chargingCost ?? asset.chargingCostTotal ?? fromRows?.charging) || 0;
    const other = Number(opts.otherCost ?? asset.otherCostTotal ?? fromRows?.other) || 0;
    const totalOwnershipCost = Math.round((purchase.available ? purchase.value : 0) + service + repair + insurance + accessories + energy + fuel + charging + other);
    return { purchase: purchase.available ? purchase.value : 0, purchaseAvailable: purchase.available, service, repair, insurance, accessories, energy, fuel, charging, other, totalOwnershipCost, sources: { expenses: fromRows ? 'expense_rows' : 'asset_rollups_or_zero' }, label: 'Total Ownership Cost' };
  }
  function computeCostPerPeriod(ownership, asset){ return (${own.computeCostPerPeriod.toString()})(ownership, asset); }
  function computeCostPerUse(){ return { available:false }; }
  function evaluateRepairVsReplace(asset, opts={}){
    const repairCost = Number(opts.repairCost)||0;
    const purchase = Number(asset.purchasePrice||asset.value)||0;
    const current = Number(asset.currentEstimatedValue)||Math.round(purchase*0.5);
    const advice = repairCost > current * 0.5 || (opts.repairCount||0) >= 4 ? 'COMPARE_REPLACEMENT' : 'REPAIR_OK';
    return { advice, message: advice === 'COMPARE_REPLACEMENT' ? 'Consider comparing repair cost with replacement options.' : 'Repair looks reasonable vs remaining value.' };
  }
  function categorizeExpenseRow(row){ return (${own.categorizeExpenseRow.toString()})(row); }
  function computeProfileCompleteness(){ return { percent: 70, missing: ['warranty'] }; }
  function calculateHealthScore(a){ return { score: Number(a.assetHealthScore)||72, band: 'Good' }; }
  function resolveReplacementFlag(a, analytics){ return (${life.resolveReplacementFlag.toString()})(a, analytics); }
  const REPLACEMENT_FLAG = { NORMAL: 'NORMAL', WATCH: 'WATCH', REVIEW_REPLACEMENT: 'REVIEW_REPLACEMENT' };
  function buildLifecycleReport(asset, opts){
    const age = calculateAssetAge(asset);
    const status = (${life.resolveLifecycleStatus.toString()})(asset, opts);
    return { status, age, replacementFlag: resolveReplacementFlag(asset, opts.analytics||{}, opts), stages: [], events: [] };
  }
  function summarizeRepairFrequency(rows){ return (${own.summarizeRepairFrequency.toString()})(rows); }
  const ANALYTICS_DATE_RANGES = { THIS_MONTH:'this_month', LAST_3_MONTHS:'last_3_months', LAST_6_MONTHS:'last_6_months', THIS_YEAR:'this_year', LAST_YEAR:'last_year', ALL:'all', CUSTOM:'custom' };
  function filterRowsByDateRange(rows){ return { rows: rows||[], bounds: { label: 'All Time' }, filtered: false }; }
  function buildMonthlyCostSeries(rows){
    const map = {};
    for (const r of rows||[]) {
      const k = String(r.repairDate||'').slice(0,7);
      if (!k) continue;
      map[k] = (map[k]||0) + (Number(r.costInr)||0);
    }
    return Object.keys(map).sort().map(k => ({ month:k, total:map[k], service:0, repair:0, other:0, source:'Actual Recorded' }));
  }
  const LIFECYCLE_STATUS = { NEW:'NEW', ACTIVE:'ACTIVE', HIGH_MAINTENANCE:'HIGH_MAINTENANCE', AGING:'AGING', SOLD:'SOLD', ARCHIVED:'ARCHIVED', DISPOSED:'DISPOSED', END_OF_LIFE:'END_OF_LIFE', MAINTENANCE:'MAINTENANCE' };
  `,
);

const asset = {
  assetId: 'bike1',
  ownerUid: 'u1',
  categoryId: 'bike',
  nickname: 'Garage Bike',
  purchasePrice: 185000,
  purchaseDate: '2022-08-16',
  assetHealthScore: 68,
  warrantyExpiry: '2025-08-16',
};

const analytics = engine2.buildAssetAnalytics(asset, {
  expenseRows,
  actorUserId: 'u1',
  userId: 'u1',
  now: NOW,
});

ok('analytics available', analytics && analytics.available === true);
ok('age label present', analytics.age.available && /year|month|day/.test(analytics.age.label));
ok('ownership score band', ['Low', 'Moderate', 'High'].includes(analytics.ownershipScore.band));
ok('health vs cost label', Boolean(analytics.healthVsCost.label));
ok('warnings for incomplete', analytics.warnings.some((w) => w.code === 'ENERGY_UNAVAILABLE'));
ok(
  'estimated not market invent',
  analytics.currentEstimated.marketValueLabel !== 'Market Value' ||
    analytics.currentEstimated.valueSource === 'EXTERNAL_SOURCE',
);
ok('repair frequency from rows', analytics.repairFrequency.last12Months >= 2);

const unauthorized = engine2.buildAssetAnalytics(
  { ...asset, ownerUid: 'u2', ownershipType: 'PERSONAL' },
  { actorUserId: 'u1', userId: 'u2', expenseRows: [] },
);
ok('unauthorized blocked', unauthorized.error === 'UNAUTHORIZED');

const missingPurchase = engine2.buildAssetAnalytics(
  { assetId: 'x', ownerUid: 'u1', purchaseDate: '2024-01-01' },
  { actorUserId: 'u1', expenseRows: [] },
);
ok('missing purchase flagged', missingPurchase.warnings.some((w) => w.code === 'MISSING_PURCHASE_PRICE'));
ok('no invented purchase value', missingPurchase.purchase.available === false);

const score = engine2.computeOwnershipCostScore({
  period: { costPerMonth: 8000, available: true },
  repairFrequency: { last12Months: 3 },
  age: { years: 4, available: true },
  costTrend: 'Increasing',
});
ok('ownership score 0-100', score.score >= 0 && score.score <= 100);

const peers = engine2.compareAssets(
  [
    asset,
    {
      assetId: 'bike2',
      ownerUid: 'u1',
      categoryId: 'bike',
      nickname: 'Spare Bike',
      purchasePrice: 90000,
      purchaseDate: '2023-01-01',
      assetHealthScore: 80,
    },
  ],
  {
    actorUserId: 'u1',
    expenseRowsByAsset: { bike1: expenseRows, bike2: [] },
  },
);
ok('compare two assets', peers.count === 2);

const trend = engine2.analyzeRepairFrequency(expenseRows, NOW);
ok('repair freq last12', trend.last12Months >= 2);

const hv = engine2.resolveHealthVsCost(80, 'Low');
ok('excellent quadrant', hv.code === 'HIGH_HEALTH_LOW_COST');

ok('cost per year available', analytics.period.available && analytics.period.costPerYear > 0);
ok(
  'missing service history warning',
  engine2.buildAssetAnalytics(
    { assetId: 'y', ownerUid: 'u1', purchasePrice: 1000, purchaseDate: '2024-01-01' },
    { actorUserId: 'u1', expenseRows: [] },
  ).warnings.some((w) => w.code === 'INCOMPLETE_SERVICE_HISTORY'),
);
ok('maintenance frequency message', Boolean(analytics.maintenanceFrequency?.message));
ok('cost trend series array', Array.isArray(analytics.costTrendSeries));
ok('vehicle profile', analytics.categoryProfile === 'vehicle');
ok(
  'MAINTENANCE when overdue service',
  life.resolveLifecycleStatus({
    purchaseDate: '2024-01-01',
    nextServiceDue: '2025-01-01',
  }) === 'MAINTENANCE',
);
ok(
  'zero purchase no invent',
  val.resolvePurchasePrice({ purchasePrice: 0 }).available === false,
);

const loc = loadPlain(
  'src/services/finance/locationAnalytics.js',
  ['buildLocationAnalytics'],
  `
  const CURRENCY_INR = 'INR';
  function resolvePurchasePrice(a){
    const n = Number(a.purchasePrice ?? a.value);
    if (!Number.isFinite(n) || n <= 0) return { available:false, value:null, label:'Not available', currencyCode: CURRENCY_INR };
    return { available:true, value:Math.round(n), label:'Purchase Value', currencyCode: CURRENCY_INR };
  }
  function computeAssetOwnershipCost(asset){
    const p = Number(asset.purchasePrice)||0;
    return { totalOwnershipCost: p + (Number(asset.repairCostTotal)||0), repair: Number(asset.repairCostTotal)||0, service:0 };
  }
  function formatInr(n){ return '₹'+n; }
  `,
);
const locReport = loc.buildLocationAnalytics(
  [
    { assetId: 'a1', ownerUid: 'u1', categoryId: 'ac', locationPath: 'Bedroom', purchasePrice: 40000 },
    { assetId: 'a2', ownerUid: 'u1', categoryId: 'ac', locationPath: 'Living Room', purchasePrice: 45000, repairCostTotal: 2000 },
  ],
  { actorUserId: 'u1' },
);
ok('location analytics rows', locReport.rows.length === 2);

const exportMod = loadPlain('src/services/finance/analyticsExport.js', [
  'buildAnalyticsExportPayload',
  'ANALYTICS_EXPORT_FORMATS',
]);
ok(
  'export stub ready',
  exportMod.buildAnalyticsExportPayload(analytics).available === true &&
    exportMod.ANALYTICS_EXPORT_FORMATS.CSV === 'csv',
);

const large = Array.from({ length: 200 }, (_, i) => ({
  category: i % 2 ? 'repair' : 'service',
  costInr: 100 + i,
  repairDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-01`,
}));
const largeAnalytics = engine2.buildAssetAnalytics(asset, {
  expenseRows: large,
  actorUserId: 'u1',
  userId: 'u1',
  now: NOW,
});
ok('large dataset ok', largeAnalytics.available && largeAnalytics.costTrendSeries.length >= 1);

const offlineLike = engine2.buildAssetAnalytics(asset, {
  expenseRows,
  actorUserId: 'u1',
  userId: 'u1',
  now: NOW,
});
ok('offline ready flag', offlineLike.offlineReady === true);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
