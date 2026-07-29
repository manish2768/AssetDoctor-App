# Asset & OCR Management

## Modules

| File | Role |
|------|------|
| `ocr/OcrService.js` | Strict ML Kit text → allowlisted fields |
| `assets/AssetService.js` | Storage upload + Firestore CRUD + live listener |
| `haptics/` | Shared success / error / tap feedback |

## OCR allowlist (only)

1. `assetName`
2. `storeName`
3. `purchaseDate`
4. `serialNumber` / `chassisNumber`
5. `warrantyExpiry` / `insuranceExpiry`

Unknown tokens are dropped. Missing values stay blank/`null` — user confirms before save.

## Flow

```text
Camera / gallery image
  → ML Kit Text Recognition (raw text)
  → OcrService.extractFromText(text)
  → User reviews fields
  → AssetService.saveAsset(userId, ocrData, localImagePath)
       → Storage: users/{uid}/bills/bill_*.jpg
       → Firestore: Users/{uid}/Assets/{assetId}
```

## Example

```js
import { OcrService, AssetService, Haptics } from '../services';

// After ML Kit returns fullText
const { success, data } = OcrService.extractFromText(mlKitFullText);
if (!success) return;

// User edits `data` in the scan modal, then:
Haptics.tap();
const result = await AssetService.saveAsset(user.uid, data, localImagePath, {
  value: 172000,
  pucExpiry: '2026-11-15',
  category: 'Vehicle',
});

// Dashboard
const unsub = AssetService.listenToUserAssets(user.uid, setAssets);
```

## Firestore doc shape — `Users/{uid}/Assets/{assetId}`

```json
{
  "assetId": "...",
  "assetName": "TVS Ronin 225 TD",
  "category": "Vehicle",
  "storeName": "TVS",
  "purchaseDate": "2024-06-12",
  "serialNumber": "",
  "chassisNumber": "MD2...",
  "warrantyExpiry": null,
  "insuranceExpiry": "2026-08-01",
  "pucExpiry": "2026-11-15",
  "value": 172000,
  "registration": "UP32 AB 1234",
  "billImageUrl": "https://...",
  "billStoragePath": "users/.../bills/bill_....jpg",
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

## Haptics

| Action | Feedback |
|--------|----------|
| Upload / OCR start | tap |
| Save start | impactMedium |
| Save / update / delete success | notificationSuccess |
| Any failure | notificationError |
