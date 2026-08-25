/**
 * Profile completeness — SEPARATE from Asset Health Score.
 */

export function computeProfileCompleteness(asset = {}) {
  const checks = [];
  const push = (key, label, ok) => checks.push({ key, label, ok: Boolean(ok), missing: !ok });

  push('name', 'Asset name', Boolean(String(asset.assetName || asset.nickname || '').trim()));
  push('purchaseDate', 'Purchase date', Boolean(asset.purchaseDate));
  push(
    'purchasePrice',
    'Purchase price',
    Number(asset.purchasePrice ?? asset.value) > 0,
  );
  push(
    'identifier',
    'Serial / IMEI / Registration',
    Boolean(asset.serialNumber || asset.imei || asset.registration || asset.chassisNumber),
  );
  push(
    'document',
    'Purchase invoice / bill',
    Boolean(asset.hasBill || asset.billImageUrl || asset.billThumbDataUrl || asset.ocrExtract),
  );

  const id = String(asset.categoryId || '').toLowerCase();
  const isVehicle = ['car', 'bike', 'scooter', 'ev', 'commercial'].includes(id);
  const isGadget = ['mobile', 'laptop', 'tablet', 'phone'].includes(id);
  const isAppliance = ['ac', 'fridge', 'washing_machine', 'tv', 'geyser', 'microwave'].includes(id);

  if (isVehicle) {
    push('insurance', 'Insurance expiry', Boolean(asset.insuranceExpiry));
    push('puc', 'PUC expiry', Boolean(asset.pucExpiry));
    push('registration', 'Registration number', Boolean(asset.registration));
  }
  if (isGadget || isAppliance) {
    push('warranty', 'Warranty expiry', Boolean(asset.warrantyExpiry));
  }
  if (isAppliance) {
    push('location', 'Location', Boolean(asset.locationId || asset.locationPath || asset.nickname));
  }

  const total = checks.length || 1;
  const done = checks.filter((c) => c.ok).length;
  const percent = Math.round((done / total) * 100);
  const missing = checks.filter((c) => c.missing).map((c) => c.label);

  return {
    percent,
    done,
    total,
    missing,
    checks,
    label: 'Profile Completeness',
    // Explicit separation
    note: 'Completeness measures data quality — not Asset Health.',
  };
}

export default { computeProfileCompleteness };
