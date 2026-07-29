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

const AuthContext = createContext(null);

/**
 * @typedef {Object} AuthContextValue
 * @property {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} user
 * @property {object | null} profile
 * @property {boolean} loading
 * @property {(idToken: string) => Promise<object>} signInWithGoogle
 * @property {(phone: string) => Promise<object>} sendOTP
 * @property {(confirmation: object, code: string) => Promise<object>} verifyOTP
 * @property {(updates: object) => Promise<object>} updateProfile
 * @property {() => Promise<object>} signOut
 */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = AuthService.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const synced = await UserService.syncUserToFirestore(firebaseUser);
        setProfile(synced);
      } catch {
        const existing = await UserService.getProfile(firebaseUser.uid);
        setProfile(existing);
      } finally {
        setLoading(false);
      }
    });

    return unsubAuth;
  }, []);

  // Live Firestore profile while signed in
  useEffect(() => {
    if (!user?.uid) return undefined;
    return UserService.subscribeToProfile(user.uid, setProfile);
  }, [user?.uid]);

  const signInWithGoogle = useCallback(async (idToken) => {
    const result = await AuthService.signInWithGoogle(idToken);
    if (result.success) setProfile(result.profile || null);
    return result;
  }, []);

  const sendOTP = useCallback(async (phoneNumber) => {
    return AuthService.sendOTP(phoneNumber);
  }, []);

  const verifyOTP = useCallback(async (confirmation, otpCode) => {
    const result = await AuthService.verifyOTP(confirmation, otpCode);
    if (result.success) setProfile(result.profile || null);
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

  const signOut = useCallback(async () => {
    const result = await AuthService.signOut();
    if (result.success) {
      setUser(null);
      setProfile(null);
    }
    return result;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signInWithGoogle,
      sendOTP,
      verifyOTP,
      updateProfile,
      signOut,
      isAuthenticated: Boolean(user),
    }),
    [
      user,
      profile,
      loading,
      signInWithGoogle,
      sendOTP,
      verifyOTP,
      updateProfile,
      signOut,
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
