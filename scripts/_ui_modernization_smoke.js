/**
 * STEP 13 — UI modernization smoke checks (static).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('\n=== UI Modernization Smoke (STEP 13) ===\n');

ok('palettes exist', fs.existsSync(path.join(root, 'src/theme/palettes.js')));
ok('tokens exist', fs.existsSync(path.join(root, 'src/theme/tokens.js')));
ok('ThemeProvider exists', fs.existsSync(path.join(root, 'src/context/ThemeProvider.jsx')));
ok('DesignSystem exists', fs.existsSync(path.join(root, 'src/components/ui/DesignSystem.jsx')));
ok('SmartAssetListCard exists', fs.existsSync(path.join(root, 'src/components/ui/SmartAssetListCard.jsx')));
ok('GlobalSearch exists', fs.existsSync(path.join(root, 'src/screens/search/GlobalSearchScreen.jsx')));
ok('ScanAssetQr exists', fs.existsSync(path.join(root, 'src/screens/assets/ScanAssetQrScreen.jsx')));

const branding = read('src/theme/branding.js');
ok('semantic primary', /primary:/.test(read('src/theme/palettes.js')));
ok('TYPE scale exported', /export const TYPE/.test(read('src/theme/tokens.js')));
ok('elevation helper', /export function elevation/.test(read('src/theme/tokens.js')));
ok('buildNavTheme', /buildNavTheme/.test(branding));
ok('COLORS re-exports light', /export const COLORS/.test(branding));

const app = read('App.js');
ok('ThemeProvider wired', /ThemeProvider/.test(app));

const nav = read('src/navigation/RootNavigator.jsx');
ok('nav uses theme', /navTheme/.test(nav) && /useTheme/.test(nav));
ok('NotificationSettings registered', /name="NotificationSettings"/.test(nav));
ok('GlobalSearch registered', /name="GlobalSearch"/.test(nav));
ok('ScanAssetQr registered', /name="ScanAssetQr"/.test(nav));

const dash = read('src/screens/dashboard/DashboardScreen.jsx');
ok('dashboard quick actions', /QuickActionGrid/.test(dash));
ok('dashboard summary strip', /summaryStrip/.test(dash));
ok('dashboard health attention', /attentionCount/.test(dash));
ok('dashboard search + notif', /GlobalSearch/.test(dash) && /NotificationCenter/.test(dash));

const gauge = read('src/components/HealthScoreGauge.jsx');
ok('gauge /100 display', /\/100/.test(gauge));
ok('gauge View Details', /View Details/.test(gauge));

const list = read('src/screens/assets/AssetListScreen.jsx');
ok('smart cards on list', /SmartAssetListCard/.test(list));
ok('filter chips', /FilterChip/.test(list) && /Needs Attention/.test(list));

const scan = read('src/screens/ScanBillScreen.jsx');
ok('OCR meaningful labels', /Detecting document|Extracting details|Identifying document/.test(scan));
ok('no bare Loading only default', !/useState\('Loading…'\)/.test(scan));

const privacy = read('src/screens/settings/PrivacySecurityScreen.jsx');
ok('dark mode toggle', /Dark mode/.test(privacy) && /setMode/.test(privacy));

const glass = read('src/components/ui/Glass.jsx');
ok('Glass theme-aware', /useThemeColors/.test(glass));
ok('Glass keeps BRAND footer', /BRAND/.test(glass));
ok('TabBar responsive width', /useWindowDimensions/.test(read('src/components/CustomBottomTabBar.jsx')));
ok('TabBar theme colors', /useThemeColors/.test(read('src/components/CustomBottomTabBar.jsx')));
ok('SyncEngine imported', /import \{ SyncEngine \}/.test(nav) || /from '..\/services\/offline\/SyncEngine'/.test(nav));
ok('Settings deep-link Maintenance', /name="Maintenance"/.test(nav) && /SettingsStackNav|SettingsHome/.test(nav));
ok('responsive helper', fs.existsSync(path.join(root, 'src/utils/responsive.js')));
ok('dangerSoft in palette', /dangerSoft/.test(read('src/theme/palettes.js')));
ok('Offline banner theme', /useThemeColors/.test(read('src/components/OfflineSyncBanner.jsx')));
ok('Notif priority text', /priorityMeta|Critical/.test(read('src/screens/notifications/NotificationCenterScreen.jsx')));
ok('Dashboard a11y search', /accessibilityLabel="Search vault"/.test(dash));

// No Shared Expense / Smart Split / AI Chatbot screens added
ok(
  'no Shared Expense screen',
  !fs.existsSync(path.join(root, 'src/screens/expenses/SharedExpenseScreen.jsx')),
);
ok(
  'no AI Chatbot screen',
  !fs.existsSync(path.join(root, 'src/screens/chat/AiChatbotScreen.jsx')),
);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
