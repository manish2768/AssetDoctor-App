/**
 * Guest demo data — browse features without signing in.
 * Writes still require login (authGate).
 */

export const DEMO_ASSETS = [
  {
    id: 'demo_bike',
    assetId: 'demo_bike',
    assetName: 'TVS Ronin 225',
    categoryId: 'bike',
    category: 'Vehicle',
    categoryLabel: 'Bike',
    icon: '🏍️',
    status: 'active',
    value: 175000,
    purchaseDate: '2024-06-12',
    registration: 'MH12 AB 1234',
    insuranceExpiry: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 4);
      return d.toISOString().slice(0, 10);
    })(),
    pucExpiry: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 18);
      return d.toISOString().slice(0, 10);
    })(),
    warrantyExpiry: '2026-12-01',
    nextServiceDue: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 25);
      return d.toISOString().slice(0, 10);
    })(),
    odometerKm: 12450,
    nextServiceOdometerKm: 12570,
    condition: 'good',
    powerWatts: 0,
    dailyHours: 0,
    isDemo: true,
  },
  {
    id: 'demo_car',
    assetId: 'demo_car',
    assetName: 'Hyundai Creta',
    categoryId: 'car',
    category: 'Vehicle',
    categoryLabel: 'Car',
    icon: '🚗',
    status: 'active',
    value: 1450000,
    purchaseDate: '2023-03-20',
    registration: 'MH14 CD 5678',
    insuranceExpiry: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 40);
      return d.toISOString().slice(0, 10);
    })(),
    pucExpiry: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 9);
      return d.toISOString().slice(0, 10);
    })(),
    warrantyExpiry: null,
    nextServiceDue: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 12);
      return d.toISOString().slice(0, 10);
    })(),
    odometerKm: 28880,
    nextServiceOdometerKm: 29000,
    condition: 'excellent',
    powerWatts: 0,
    dailyHours: 0,
    isDemo: true,
  },
  {
    id: 'demo_ac',
    assetId: 'demo_ac',
    assetName: 'Daikin 1.5T AC',
    categoryId: 'ac',
    category: 'Electronics',
    categoryLabel: 'AC',
    icon: '❄️',
    status: 'active',
    value: 42000,
    purchaseDate: '2024-04-01',
    registration: '',
    insuranceExpiry: null,
    pucExpiry: null,
    warrantyExpiry: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 60);
      return d.toISOString().slice(0, 10);
    })(),
    nextServiceDue: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })(),
    condition: 'good',
    powerWatts: 1500,
    powerFactor: 0.85,
    dailyHours: 6,
    isDemo: true,
  },
];

export function isDemoAssetId(id) {
  return String(id || '').startsWith('demo_');
}

export default DEMO_ASSETS;
