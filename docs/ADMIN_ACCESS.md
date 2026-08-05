# Grant Admin Access (Firebase custom claim)

**Target admin account:** `manish2768@gmail.com`

Admin panel needs custom claim `{ admin: true }`. Password = whatever you set in Firebase Auth (no default).

## Do this once

### 1) Create / confirm the user
Firebase Console → [Authentication → Users](https://console.firebase.google.com/project/assetdoctor-5fd25/authentication/users)

- Email: `manish2768@gmail.com`
- Password: set your own (remember it)

### 2) Download Admin SDK key
Firebase Console → Project settings → **Service accounts** → **Generate new private key**

Save the JSON as:

`D:\AssetDoctor_App\functions\serviceAccount.json`

(This file is gitignored — never commit it.)

### 3) Grant claim
```powershell
cd D:\AssetDoctor_App
node scripts/grant-admin.js manish2768@gmail.com
```

Expected: `OK — granted admin:true to manish2768@gmail.com`

### 4) Login
1. Open `admin.html`
2. Email: `manish2768@gmail.com`
3. Password: the one you set in step 1
4. If still Demo Mode → Sign out → Sign in again

## Until claim is set
Use **Continue in Demo Mode** (no password needed).
