# Asset Doctor — Meta WhatsApp Cloud API Setup Guide

This guide details the complete process for connecting the Meta WhatsApp Cloud API to the Asset Doctor Notification and Expiry Automation Engine.

---

## 1. Meta Developer App & Business Portfolio
1. Go to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Create a new App of type **Business**.
3. Link your verified Meta Business Portfolio / Business Manager.

## 2. WhatsApp Cloud API Setup
1. In your App Dashboard, add the **WhatsApp** product.
2. Navigate to **WhatsApp > API Setup**.
3. Note your **Phone Number ID** and **WhatsApp Business Account (WABA) ID**.

## 3. System User & Permanent Access Token
1. Go to **Business Manager Settings > Users > System Users**.
2. Create a System User with role **Admin**.
3. Assign the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Generate a **Permanent Access Token**.
5. Save this token securely as `META_ACCESS_TOKEN`.

## 4. Webhook Subscription & Verification
1. In your Meta App, go to **WhatsApp > Configuration**.
2. Set the **Callback URL** to:
   `https://assetdoctor.in/api/webhook/whatsapp`
3. Set the **Verify Token** to your configured `META_WEBHOOK_VERIFY_TOKEN`.
4. Click **Verify and Save**.
5. Under Webhook fields, subscribe to:
   - `messages` (delivers incoming messages and status receipts: `sent`, `delivered`, `read`, `failed`).

## 5. WhatsApp Business Phone Number Registration
1. In the WhatsApp Cloud API console, add your official business phone number.
2. Complete SMS/Voice OTP verification.
3. Complete 2-Step Verification PIN configuration.

## 6. Environment Variables (Server-Side Only)
Configure the following environment secrets in your hosting provider (Vercel / Cloud Run):

```bash
META_ACCESS_TOKEN="<Permanent System User Token>"
META_APP_ID="<Meta App ID>"
META_APP_SECRET="<Meta App Secret>"
META_WABA_ID="<WhatsApp Business Account ID>"
META_PHONE_NUMBER_ID="<Phone Number ID>"
META_WEBHOOK_VERIFY_TOKEN="<Arbitrary secure random string>"
META_API_VERSION="v20.0"
```

> [!CAUTION]
> Never expose these variables in frontend JavaScript, public HTML, or Git repositories.

## 7. Template Approval Lifecycle
1. Open the Asset Doctor Admin Console at `https://assetdoctor.in/admin`.
2. Navigate to **WhatsApp Control > Template Manager**.
3. Draft or modify templates conforming to Meta's utility categories.
4. Click **Submit to Meta** for review.
5. Meta typically reviews transactional/utility templates within 1–24 hours.
6. Once status updates to `APPROVED`, the Expiry Automation Engine will automatically dispatch notifications through that template.
