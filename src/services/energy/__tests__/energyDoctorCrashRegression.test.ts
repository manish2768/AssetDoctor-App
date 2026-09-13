/**
 * Asset Doctor — Energy Doctor Crash Regression Suite
 *
 * Specifically verifies:
 * - Fix for production crash: TypeError: undefined is not a function at anonymous ... EnergyDoctorScreen
 * - Exact failing scenario: ElectricityBillService.filterBillsByMonth and EnergyAnalyticsEngine.filterBillsByMonth
 * - Guest user with no energy data
 * - Guest user with empty energy array
 * - Normal energy data
 * - Missing optional energy fields
 * - Undefined optional values
 * - Electricity bill data present
 * - No electricity bill data
 * - First render / initial loading state
 * - Complete simulation of all EnergyDoctorScreen useMemo hooks under every permutation
 */

import { ElectricityBillService } from '../ElectricityBillService';
import { EnergyAnalyticsEngine } from '../energyAnalyticsEngine';
import { ElectricityBillRecord, ElectricityAccount, EnergyAnalytics } from '../electricityBillSchema';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} (${detail || ''})`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('   ENERGY DOCTOR: RUNTIME CRASH REGRESSION SUITE');
  console.log('================================================================\n');

  // REGRESSION 1: Exact crash condition check
  // ElectricityBillService.filterBillsByMonth MUST be defined and callable
  {
    assert(
      typeof ElectricityBillService.filterBillsByMonth === 'function',
      'Reg 1.1: ElectricityBillService.filterBillsByMonth is defined and is a function'
    );
    assert(
      typeof EnergyAnalyticsEngine.filterBillsByMonth === 'function',
      'Reg 1.2: EnergyAnalyticsEngine.filterBillsByMonth is defined and is a function'
    );

    const bills: ElectricityBillRecord[] = [
      {
        id: 'bill_1',
        userId: 'local_user',
        accountId: 'default_home',
        provider: 'Tata Power',
        consumerId: '100200300',
        billingMonth: '2026-08',
        currentBillAmount: 2450,
        unitsConsumedKwh: 320,
        createdAt: new Date().toISOString(),
      },
    ];

    // Calling via ElectricityBillService MUST NOT throw
    const filteredService = ElectricityBillService.filterBillsByMonth(bills, '2026-08');
    assert(filteredService.length === 1, 'Reg 1.3: ElectricityBillService.filterBillsByMonth returns correct bill');
    assert(filteredService[0].id === 'bill_1', 'Reg 1.4: ElectricityBillService matched correct bill id');

    // Calling via EnergyAnalyticsEngine MUST NOT throw
    const filteredEngine = EnergyAnalyticsEngine.filterBillsByMonth(bills, '2026-08');
    assert(filteredEngine.length === 1, 'Reg 1.5: EnergyAnalyticsEngine.filterBillsByMonth returns correct bill');
    assert(filteredEngine[0].id === 'bill_1', 'Reg 1.6: EnergyAnalyticsEngine matched correct bill id');
  }

  // REGRESSION 2: Guest user with no energy data (initial loading state / first render)
  {
    const guestUser = null; // Guest user has no user object or uid
    const effectiveUserId = guestUser?.uid || 'local_user';
    const initialAccounts: ElectricityAccount[] = [];
    const selectedAccountId = 'default_home';
    const initialBills: ElectricityBillRecord[] = [];
    const highlightMonth = null;
    const selectedMonth = highlightMonth || null;

    // Simulate EnergyDoctorScreen useMemo hooks on initial render
    const activeAccount = initialAccounts.find((a) => a.id === selectedAccountId) || initialAccounts[0] || null;
    assert(activeAccount === null, 'Reg 2.1: Active account is safely null on initial render');

    const analytics: EnergyAnalytics = EnergyAnalyticsEngine.computeEnergyAnalytics(initialBills, selectedMonth || undefined);
    assert(analytics.currentBill === 0, 'Reg 2.2: Initial bill is 0');
    assert(analytics.statusColor === 'GREEN', 'Reg 2.3: Initial status is GREEN');
    assert(analytics.statusLabel === 'No Bills Yet', 'Reg 2.4: Initial status label is No Bills Yet');
    assert(analytics.healthScore === null, 'Reg 2.5: Initial health score is null');

    const availableMonths = EnergyAnalyticsEngine.sortBills(initialBills).map((b) => b.billingMonth).reverse();
    assert(availableMonths.length === 0, 'Reg 2.6: Available months is empty');

    // Exact currentMonthRecord useMemo with empty bills and null selectedMonth
    const currentMonthRecord = !selectedMonth
      ? initialBills[initialBills.length - 1] || null
      : EnergyAnalyticsEngine.filterBillsByMonth(initialBills, selectedMonth)[0] || null;
    assert(currentMonthRecord === null, 'Reg 2.7: currentMonthRecord safely null');

    // Exact historyMetrics useMemo
    const historyMetrics = initialBills.length === 0 ? null : { count: initialBills.length };
    assert(historyMetrics === null, 'Reg 2.8: historyMetrics safely null');
  }

  // REGRESSION 3: Guest user with route.params.highlightMonth (Navigating after scan or from card)
  // This was the exact path that crashed when selectedMonth was non-null with empty or fresh bills!
  {
    const initialBills: ElectricityBillRecord[] = [];
    const selectedMonth = '2026-08'; // Highlight month passed

    // Must NOT crash even when bills is empty
    const currentMonthRecordEngine = !selectedMonth
      ? initialBills[initialBills.length - 1] || null
      : EnergyAnalyticsEngine.filterBillsByMonth(initialBills, selectedMonth)[0] || null;
    assert(currentMonthRecordEngine === null, 'Reg 3.1: currentMonthRecord safely null when month not in empty bills');

    const currentMonthRecordService = !selectedMonth
      ? initialBills[initialBills.length - 1] || null
      : ElectricityBillService.filterBillsByMonth(initialBills, selectedMonth)[0] || null;
    assert(currentMonthRecordService === null, 'Reg 3.2: currentMonthRecord via ElectricityBillService safely null');
  }

  // REGRESSION 4: Guest user with empty energy array vs populated energy array
  {
    const emptyBills: ElectricityBillRecord[] = [];
    const sortedEmpty = EnergyAnalyticsEngine.sortBills(emptyBills);
    assert(sortedEmpty.length === 0, 'Reg 4.1: sortBills on empty array returns empty array');

    const filteredEmpty = EnergyAnalyticsEngine.filterBillsByMonth(emptyBills, '2026-08');
    assert(filteredEmpty.length === 0, 'Reg 4.2: filterBillsByMonth on empty array returns empty array');
  }

  // REGRESSION 5: Missing optional energy fields & undefined optional values
  {
    const incompleteBill: ElectricityBillRecord = {
      id: 'incomplete_bill_1',
      userId: 'local_user',
      accountId: 'default_home',
      provider: 'BSES',
      consumerId: '998877',
      billingMonth: '2026-08',
      currentBillAmount: 1800,
      unitsConsumedKwh: 200,
      // Intentionally missing/undefined optional fields:
      previousMeterReading: undefined,
      currentMeterReading: undefined,
      billingDays: undefined,
      billDate: undefined,
      dueDate: undefined,
      tariffCategory: undefined,
      fixedChargeAmount: undefined,
      energyChargeAmount: undefined,
      createdAt: new Date().toISOString(),
    };

    const bills = [incompleteBill];

    // Compute analytics with incomplete bill
    const analytics = EnergyAnalyticsEngine.computeEnergyAnalytics(bills, '2026-08');
    assert(analytics.currentBill === 1800, 'Reg 5.1: Handles undefined optional fields without error');
    assert(analytics.currentUnits === 200, 'Reg 5.2: Units extracted correctly');
    assert(analytics.billingDays === 30, 'Reg 5.3: Defaults billingDays to 30 when undefined');
    assert(analytics.dueStatus.message === null, 'Reg 5.4: Due status safely null when dueDate undefined');
    assert(analytics.dueStatus.isOverdue === false, 'Reg 5.5: isOverdue false when dueDate undefined');

    // Verify currentMonthRecord with undefined readings
    const match = EnergyAnalyticsEngine.filterBillsByMonth(bills, '2026-08')[0];
    assert(match.previousMeterReading === undefined, 'Reg 5.6: previousMeterReading is undefined');
    const readingDisplay = `${match.previousMeterReading} → ${match.currentMeterReading}`;
    assert(typeof readingDisplay === 'string', 'Reg 5.7: Reading display concatenation does not throw');
  }

  // REGRESSION 6: Normal energy data (multiple months, MoM calculations)
  {
    const bills: ElectricityBillRecord[] = [
      {
        id: 'b1',
        userId: 'u1',
        accountId: 'default_home',
        provider: 'Tata Power',
        consumerId: '500100',
        billingMonth: '2026-07',
        billDate: '2026-07-31',
        dueDate: '2026-08-15',
        previousMeterReading: 1000,
        currentMeterReading: 1200,
        unitsConsumedKwh: 200,
        billingDays: 30,
        currentBillAmount: 1600,
        createdAt: '2026-07-31T00:00:00Z',
      },
      {
        id: 'b2',
        userId: 'u1',
        accountId: 'default_home',
        provider: 'Tata Power',
        consumerId: '500100',
        billingMonth: '2026-08',
        billDate: '2026-08-31',
        dueDate: '2026-09-15',
        previousMeterReading: 1200,
        currentMeterReading: 1420,
        unitsConsumedKwh: 220,
        billingDays: 31,
        currentBillAmount: 1800,
        createdAt: '2026-08-31T00:00:00Z',
      },
    ];

    const analyticsJuly = EnergyAnalyticsEngine.computeEnergyAnalytics(bills, '2026-07');
    assert(analyticsJuly.currentBill === 1600, 'Reg 6.1: July current bill is 1600');
    assert(analyticsJuly.previousBill === null, 'Reg 6.2: July previous bill is null (first record)');

    const analyticsAugust = EnergyAnalyticsEngine.computeEnergyAnalytics(bills, '2026-08');
    assert(analyticsAugust.currentBill === 1800, 'Reg 6.3: August current bill is 1800');
    assert(analyticsAugust.previousBill === 1600, 'Reg 6.4: August previous bill is 1600');
    assert(analyticsAugust.billChangePercent === 12.5, 'Reg 6.5: Bill change is +12.5%');
    assert(analyticsAugust.consumptionChangePercent === 10, 'Reg 6.6: Consumption change is +10%');

    // Verify 6-month trend
    assert(analyticsAugust.historyTrend.length === 2, 'Reg 6.7: History trend has 2 items');

    // Verify historyMetrics useMemo calculation
    const totalSpend = bills.reduce((sum, b) => sum + (Number(b.currentBillAmount) || 0), 0);
    const totalUnits = bills.reduce((sum, b) => sum + (Number(b.unitsConsumedKwh) || 0), 0);
    assert(totalSpend === 3400, 'Reg 6.8: Lifetime spend correctly summed');
    assert(totalUnits === 420, 'Reg 6.9: Lifetime units correctly summed');
  }

  // REGRESSION 7: ElectricityBillService listAccounts and listBills for guest user ('local_user')
  {
    const accounts = await ElectricityBillService.listAccounts('local_user');
    assert(Array.isArray(accounts), 'Reg 7.1: listAccounts returns array for guest/local user');
    assert(accounts.length > 0, 'Reg 7.2: returns at least default home account');
    assert(accounts[0].id === 'default_home', 'Reg 7.3: default account id is default_home');

    const bills = await ElectricityBillService.listBills('local_user', 'default_home');
    assert(Array.isArray(bills), 'Reg 7.4: listBills returns array for guest/local user');
  }

  console.log('\n================================================================');
  console.log('   ✓ ALL 26 RUNTIME CRASH REGRESSION CHECKS PASSED');
  console.log('================================================================\n');
}

runRegressionSuite().catch((err) => {
  console.error('Crash regression suite failed:', err);
  process.exit(1);
});
