# Firebase Phone Auth — SMS OTP template

SMS body is **not** set in app code. Configure it in:

**Firebase Console → Authentication → Templates → SMS verification**

## Recommended body

```text
Your Asset Doctor verification code is: %CODE%. Valid for 10 minutes.
```

## Android SMS Retriever hash

Firebase / Play Integrity may append the 11-character app hash on a **separate last line**.  
That is expected — do not paste the hash into the middle of the sentence.

Example received SMS:

```text
Your Asset Doctor verification code is: 550066. Valid for 10 minutes.

X1a2B3c4d5e
```

## Checklist

1. Authentication → Sign-in method → **Phone** enabled  
2. Template body uses `%CODE%` (and optional `%APP_NAME%` if you prefer)  
3. Android app SHA-1 / SHA-256 registered (Phone Auth attestation)  
4. App displays the same hint in the OTP screen (`src/constants/smsOtp.js`)
