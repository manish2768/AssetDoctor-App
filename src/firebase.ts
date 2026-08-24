import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  type ConfirmationResult
} from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';

const getEnv = (key: string, fallback: string) => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch (_) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (_) {}
  return fallback;
};

// Firebase project configuration for production assetdoctor-5fd25
export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', 'AIzaSyAYpEIXCZz3VKFMza3jpUMGTSRbi37qk-c'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'assetdoctor-5fd25.firebaseapp.com'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'assetdoctor-5fd25'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'assetdoctor-5fd25-vault'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '926559836985'),
  appId: getEnv('VITE_FIREBASE_APP_ID', '1:926559836985:web:842e878c508df93d2b66e8')
};

// Initialize Firebase App instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Initialize Firestore with offline multi-tab persistence
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Fallback if already initialized
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const googleProvider = new GoogleAuthProvider();

// Recaptcha Helper for Mobile OTP Authentication
export const setupRecaptcha = (containerId: string) => {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved callback
    }
  });
};

export { signInWithPhoneNumber, type ConfirmationResult };
