# Auth & User Management (Firebase)

Modular React Native services for **Asset Doctor**.

## Layout

```
src/
  services/
    haptics/triggerHaptic.js   # All haptic-touch helpers
    auth/AuthService.js        # Google + Phone OTP
    user/UserService.js        # Firestore Users/{uid}
    constants.js
    index.js
  context/AuthProvider.jsx     # App-wide auth + profile state
  screens/LoginScreen.example.jsx
```

## Install (inside your RN app)

```bash
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
npm install @react-native-google-signin/google-signin react-native-haptic-feedback
```

## Wire once at app root

```jsx
import { AuthProvider } from './src/context/AuthProvider';

export default function App() {
  return (
    <AuthProvider>
      {/* Navigation */}
    </AuthProvider>
  );
}
```

```jsx
import { useAuth } from './src/context/AuthProvider';
import { Haptics } from './src/services';

const { signInWithGoogle, sendOTP, verifyOTP, updateProfile, signOut, profile } = useAuth();
```

## Haptics

Every auth action already triggers:

| Event | Haptic |
|-------|--------|
| Button / start | `impactLight` (tap) |
| OTP verify attempt | `impactMedium` |
| Success | `notificationSuccess` |
| Error | `notificationError` |

Use `Haptics.tap()` / `Haptics.success()` / `Haptics.error()` on other UI buttons too.

## Firestore shape — `Users/{uid}`

```json
{
  "uid": "...",
  "email": "",
  "phone": "",
  "name": "Asset Owner",
  "address": "",
  "photoURL": "",
  "authProvider": "google | phone",
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

## Firebase Console checklist

1. Enable **Google** and **Phone** sign-in methods  
2. Add Android SHA-1 / iOS URL schemes  
3. Create Firestore `Users` collection (auto-created on first sync)  
4. Set security rules so users can only read/write their own `Users/{uid}` doc
