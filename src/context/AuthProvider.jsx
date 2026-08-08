/**
 * Asset Doctor — Auth Context Provider
 * Wires Firebase auth state + Firestore profile for the React Native app tree.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AuthService } from '../services/auth';
import { UserService } from '../services/user';
import { Haptics } from '../services/haptics';
import { CrashlyticsService } from '../services/crashlytics/CrashlyticsService';
import { needsProfileSetup as checkProfileSetup } from '../utils/profileSetup';

const AuthContext = createContext(null);

/**
 * @typedef {Object} AuthContextValue
 * @property {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} user
 * @property {object | null} profile
 * @property {boolean} loading
 * @property {(idToken: string) => Promise<object>} signInWithGoogle
 * @property {(phone: string, options?: { channel?: 'whatsapp' | 'sms' | 'auto' }) => Promise<object>} sendOTP
 * @property {(confirmation: object, code: string, options?: { name?: string }) => Promise<object>} verifyOTP
 * @property {(updates: object) => Promise<object>} updateProfile
 * @property {() => Promise<object>} signOut
 */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubAuth = () => {};
    try {
      unsubAuth = AuthService.onAuthStateChanged(async (firebaseUser) => {
        setUser(firebaseUser);

        if (!firebaseUser) {
          setProfile(null);
          CrashlyticsService.clearUser();
          setLoading(false);
          return;
        }

        CrashlyticsService.setUser(firebaseUser);

        try {
          const synced = await UserService.syncUserToFirestore(firebaseUser);
          setProfile(synced);
        } catch (error) {
          console.warn('[AssetDoctor] profile sync failed:', error?.message || error);
          try {
            const existing = await UserService.getProfile(firebaseUser.uid);
            setProfile(
              existing || {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.phoneNumber || '',
                email: firebaseUser.email || '',
                phone: firebaseUser.phoneNumber || '',
              },
            );
          } catch {
            setProfile({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.phoneNumber || '',
              email: firebaseUser.email || '',
              phone: firebaseUser.phoneNumber || '',
            });
          }
        } finally {
          setLoading(false);
        }
      });
    } catch (error) {
      console.warn('[AssetDoctor] Auth listener failed:', error?.message || error);
      setLoading(false);
    }

    return () => {
      try {
        unsubAuth?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Live Firestore profile while signed in
  useEffect(() => {
    if (!user?.uid) return undefined;
    return UserService.subscribeToProfile(user.uid, setProfile);
  }, [user?.uid]);

  const signInWithGoogle = useCallback(async (idToken) => {
    // idToken optional — AuthService runs GoogleSignin when omitted
    const result = await AuthService.signInWithGoogle(idToken);
    if (result.success) setProfile(result.profile || null);
    return result;
  }, []);

  const sendOTP = useCallback(async (phoneNumber, options) => {
    return AuthService.sendOTP(phoneNumber, options);
  }, []);

  const verifyOTP = useCallback(async (confirmation, otpCode, options) => {
    const result = await AuthService.verifyOTP(confirmation, otpCode, options);
    // Only attach profile after a verified success — never on invalid OTP
    if (result.success && result.user) setProfile(result.profile || null);
    return result;
  }, []);

  const signUpWithEmail = useCallback(async (payload) => {
    const result = await AuthService.signUpWithEmail(payload);
    if (result.success) setProfile(result.profile || null);
    return result;
  }, []);

  const signInWithEmail = useCallback(async (payload) => {
    const result = await AuthService.signInWithEmail(payload);
    if (result.success) setProfile(result.profile || null);
    return result;
  }, []);

  const sendEmailVerification = useCallback(async () => AuthService.sendEmailVerification(), []);

  const reloadUser = useCallback(async () => {
    const result = await AuthService.reloadUser();
    if (result.success && result.user) setUser(result.user);
    return result;
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user?.uid) {
        Haptics.error();
        return { success: false, error: 'Not signed in' };
      }
      const result = await UserService.updateProfile(user.uid, updates);
      if (result.success) setProfile(result.profile || null);
      return result;
    },
    [user?.uid],
  );

  const completeProfileSetup = useCallback(
    async (payload) => {
      if (!user?.uid) {
        Haptics.error();
        return { success: false, error: 'Not signed in' };
      }
      const result = await UserService.completeProfileSetup(user.uid, payload);
      if (result.success) {
        setProfile(result.profile || null);
        try {
          if (payload?.name && user.displayName !== payload.name) {
            await user.updateProfile({ displayName: payload.name });
          }
        } catch {
          /* non-blocking */
        }
      }
      return result;
    },
    [user],
  );

  const needsProfileSetup = useMemo(
    () => checkProfileSetup(profile, user),
    [profile, user],
  );

  const signOut = useCallback(async () => {
    const result = await AuthService.signOut();
    if (result.success) {
      setUser(null);
      setProfile(null);
      CrashlyticsService.clearUser();
    }
    return result;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendEmailVerification,
      reloadUser,
      sendOTP,
      verifyOTP,
      updateProfile,
      completeProfileSetup,
      signOut,
      isAuthenticated: Boolean(user),
      needsProfileSetup,
      emailVerified: Boolean(user?.emailVerified || profile?.emailVerified),
    }),
    [
      user,
      profile,
      loading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendEmailVerification,
      reloadUser,
      sendOTP,
      verifyOTP,
      updateProfile,
      completeProfileSetup,
      signOut,
      needsProfileSetup,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * @returns {AuthContextValue}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export default AuthProvider;
