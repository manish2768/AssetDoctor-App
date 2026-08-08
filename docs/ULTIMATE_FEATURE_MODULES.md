# Asset Doctor — Ultimate Feature Modules

Production stack: **React Native (Expo) + Firebase Auth/Firestore + Meta WhatsApp Cloud API**.

> Note: This repo is Expo/React Native, not Kotlin/Java. Native Android layouts are not used; equivalent screens live under `src/screens/`.

---

## 1. Profile Setup & Management

| Piece | Path |
| --- | --- |
| Post-Gmail setup modal | `src/components/profile/ProfileSetupModal.jsx` |
| Setup gate logic | `src/utils/profileSetup.js` |
| Profile screen (edit + stats) | `src/screens/settings/ProfileScreen.jsx` |
| Firestore profile CRUD | `src/services/user/UserService.js` |
| Avatar upload | `src/services/user/ProfilePhotoService.js` |
| Auth context | `src/context/AuthProvider.jsx` (`completeProfileSetup`, `needsProfileSetup`) |

**Flow:** Gmail/email sign-in → `ProfileSetupModal` collects **Full Name + WhatsApp number** → saves `profileSetupComplete: true` → triggers welcome WhatsApp (Cloud Function).

---

## 2. WhatsApp OTP Login

| Piece | Path |
| --- | --- |
| Login UI tab | `src/screens/auth/AuthScreens.jsx` → **WhatsApp OTP** |
| Client service | `src/services/whatsapp/WhatsAppCloudService.js` |
| Auth orchestration | `src/services/auth/AuthService.js` → `sendOTP`, `verifyOTP` |
| Send OTP function | `functions/src/whatsapp/otpHandlers.js` → `sendWhatsAppOtp` |
| Verify OTP function | `functions/src/whatsapp/otpHandlers.js` → `verifyWhatsAppOtp` |

**Flow:** User enters mobile → `asset_doctor_otp` template via Meta API → 6-digit verify → Firebase custom token → signed in.

---

## 3. Automated Welcome WhatsApp

| Trigger | When |
| --- | --- |
| `onUserCreatedWelcomeWhatsApp` | New `Users/{uid}` with phone (non-OTP providers) |
| `onProfileCompletedWelcomeWhatsApp` | `profileSetupComplete` becomes `true` (Gmail/email) |
| Inline in `verifyWhatsAppOtp` | First WhatsApp OTP signup |

Template: `WHATSAPP_WELCOME_TEMPLATE` (default `welcome_gadi_doctor`).

---

## 4. Scheduled Expiry Alert Engine

| Function | Schedule | Path |
| --- | --- | --- |
| `dailyWhatsAppReminders` | **Every day 09:00 Asia/Kolkata** | `functions/src/whatsapp/dailyServiceReminders.js` |
| `runWhatsAppRemindersNow` | Admin POST (manual test) | same file |

Scans `Users/{uid}/Assets` for **PUC, Insurance, Warranty, Service** expiring in **7 days** (configurable via `WHATSAPP_REMINDER_DAYS=7`).

Template: `asset_service_reminder`.

---

## Deploy secrets

```bash
cd functions
firebase functions:secrets:set WHATSAPP_TOKEN
firebase functions:secrets:set WHATSAPP_ADMIN_SECRET
firebase deploy --only functions
```

Copy `functions/.env.example` → `functions/.env` for local emulator.

---

## Environment variables (Meta)

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_TOKEN` / `META_ACCESS_TOKEN` | Permanent Graph API token |
| `WHATSAPP_PHONE_NUMBER_ID` / `META_PHONE_NUMBER_ID` | Sender phone ID |
| `WHATSAPP_WELCOME_TEMPLATE` | Welcome template name |
| `WHATSAPP_OTP_TEMPLATE` | OTP auth template |
| `WHATSAPP_REMINDER_DAYS` | Comma-separated day offsets (default `7`) |

See also: `docs/WHATSAPP_CLOUD_API.md`
