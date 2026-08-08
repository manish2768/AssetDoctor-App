# WhatsApp Cloud API (Asset Doctor)

Backend lives under `functions/src/whatsapp/`. Templates used:

| Template | Type | Params |
| --- | --- | --- |
| `asset_doctor_otp` | Authentication | Body OTP + Copy Code / URL button OTP |
| `welcome_gadi_doctor` | Marketing | `{{1}}` user name, `{{2}}` website URL |
| `asset_service_reminder` | Utility | `{{1}}` name, `{{2}}` asset, `{{3}}` event, `{{4}}` due date |

## Configure secrets

1. Copy `functions/.env.example` → `functions/.env` and set `WHATSAPP_TOKEN`.
2. Production:

```bash
cd functions && npm install
firebase functions:secrets:set WHATSAPP_TOKEN
firebase deploy --only functions,firestore:rules
```

Pre-approved Meta credentials (set token via secret / `.env`):

| Key | Value |
| --- | --- |
| Phone Number ID | `1269029059621551` |
| WhatsApp Business Account ID | `956803424039436` |
| App ID | `1050912807397326` |
| Graph API | `v20.0` |
| Messages endpoint | `https://graph.facebook.com/v20.0/1269029059621551/messages` |

Env:

- `WHATSAPP_TOKEN` — permanent access token (secret)
- `WHATSAPP_PHONE_NUMBER_ID=1269029059621551`
- `WHATSAPP_BUSINESS_ACCOUNT_ID=956803424039436`
- `WHATSAPP_APP_ID=1050912807397326`
- `WHATSAPP_GRAPH_VERSION=v20.0`
- `WHATSAPP_API_URL=https://graph.facebook.com/v20.0/1269029059621551/messages`
- `WHATSAPP_TEMPLATE_LANG=en`

Send helpers (`functions/src/whatsapp/WhatsAppService.js`):

- `sendTemplateMessage({ to, templateName, languageCode?, components?, token? })`
- `sendTextMessage({ to, body, previewUrl?, token? })` — 24h session window only
- Recipients are normalized to E.164 **digits without `+`** (e.g. `919918288299`)

## Endpoints (asia-south1)

- `POST .../sendWhatsAppOtp` — `{ phoneNumber }` (60s resend cooldown)
- `POST .../verifyWhatsAppOtp` — `{ phoneNumber, otp, name? }` → `{ customToken, welcomeSent }` (also sends `welcome_gadi_doctor` on first verify)
- `POST .../sendWelcomeWhatsApp` — admin only: header `X-Admin-Secret` or `adminSecret` (set `WHATSAPP_ADMIN_SECRET`)
- `POST .../runWhatsAppRemindersNow` — admin only (same secret); manual reminder sweep
- Scheduled: `dailyWhatsAppReminders` — every day **09:00** Asia/Kolkata (respects `Users.whatsappRemindersOptOut`)

## Client

`AuthService.sendOTP` prefers WhatsApp when `EXPO_PUBLIC_WHATSAPP_OTP` is not `0` (default on), then falls back to Firebase SMS.
Settings → “WhatsApp service reminders” toggles opt-out.
