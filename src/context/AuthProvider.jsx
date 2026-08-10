/**
 * Asset Doctor — Auth Context Provider
 * Wires Firebase auth state + Firestore profile for the React Native app tree.
 *
 * Critical: never render signed-in UI as "Guest". Hold `loading` until the
 * Firestore `users/{uid}` profile has been fetched (or a safe auth fallback
 * is ready) after every auth transition.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AuthService } from '../services/auth';
import { UserService } from '../services/user';
import { Haptics } from '../services/haptics';
import { CrashlyticsService } from '../services/crashlytics/CrashlyticsService';
import { needsProfileSetup as checkProfileSetup } from '../utils/profileSetup';
import { resolveDisplayName } from '../utils/displayUserName';

const AuthContext = createContext(null);

function authFallbackProfile(firebaseUser) {
  if (!firebaseUser?.uid) return null;
  return {
    uid: firebaseUser.uid,
    name: resolveDisplayName({ user: firebaseUser, fallback: '' }),
    email: firebaseUser.email || '',
    phone: firebaseUser.phoneNumber || '',
    phoneNumber: firebaseUser.phoneNumber || '',
    photoURL: firebaseUser.photoURL || '',
  };
}

/**
 * @typedef {Object} AuthContextValue
 * @property {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} user
 * @property {object | null} profile
 * @property {boolean} loading
 * @property {boolean} profileReady
 * @property {string} displayName
 */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  /** Skip live subscribe until the first hydrate for this uid finishes */
  const hydrateUidRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const applyAuthenticatedProfile = useCallback((firebaseUser, nextProfile) => {
    const merged =
      nextProfile ||
      profileRef.current ||
      authFallbackProfile(firebaseUser);
    setProfile(merged);
    setProfileReady(true);
    return merged;
  }, []);

  useEffect(() => {
    let unsubAuth = () => {};
    let cancelled = false;

    try {
      unsubAuth = AuthService.onAuthStateChanged(async (firebaseUser) => {
        if (cancelled) return;

        if (!firebaseUser) {
          hydrateUidRef.current = null;
          setUser(null);
          setProfile(null);
          setProfileReady(true);
          CrashlyticsService.clearUser();
          setLoading(false);
          return;
        }

        // Hold UI until Firestore profile hydrate completes — prevents "Guest" flash
        setLoading(true);
        setProfileReady(false);
        setUser(firebaseUser);
        CrashlyticsService.setUser(firebaseUser);

        try {
          const synced = await UserService.syncUserToFirestore(firebaseUser);
          if (cancelled) return;
          applyAuthenticatedProfile(firebaseUser, synced);
          hydrateUidRef.current = firebaseUser.uid;
        } catch (error) {
          console.warn('[AssetDoctor] profile sync failed:', error?.message || error);
          try {
            const existing = await UserService.getProfile(firebaseUser.uid);
            if (cancelled) return;
            applyAuthenticatedProfile(firebaseUser, existing);
          } catch {
            if (cancelled) return;
            applyAuthenticatedProfile(firebaseUser, null);
          }
          hydrateUidRef.current = firebaseUser.uid;
        } finally {
          if (!cancelled) setLoading(false);
        }
      });
    } catch (error) {
      console.warn('[AssetDoctor] Auth listener failed:', error?.message || error);
      setProfileReady(true);
      setLoading(false);
    }

    return () => {
      cancelled = true;
      try {
        unsubAuth?.();
      } catch {
        /* ignore */
      }
    };
  }, [applyAuthenticatedProfile]);

  // Live Firestore profile while signed in — never wipe to null on transient misses
  useEffect(() => {
    if (!user?.uid) return undefined;
    if (hydrateUidRef.current !== user.uid) return undefined;

    return UserService.subscribeToProfile(user.uid, (next) => {
      if (next == null) {
        // undefined/null from subscribe = miss/error — keep last known / auth fallback
        setProfile((prev) => prev || authFallbackProfile(user));
        return;
      }
      setProfile(next);
      setProfileReady(true);
    });
  }, [user?.uid, user]);

  const attachAuthResult = useCallback(
    async (result) => {
      if (!result?.success || !result.user) return result;
      setLoading(true);
      setProfileReady(false);
      setUser(result.user);
      CrashlyticsService.setUser(result.user);
      try {
        let nextProfile = result.profile || null;
        if (!nextProfile) {
          nextProfile = await UserService.getProfile(result.user.uid);
        }
        if (!nextProfile) {
          nextProfile = await UserService.syncUserToFirestore(result.user);
        }
        applyAuthenticatedProfile(result.user, nextProfile);
        hydrateUidRef.current = result.user.uid;
      } catch (error) {
        console.warn('[AssetDoctor] post-login profile hydrate:', error?.message || error);
        applyAuthenticatedProfile(result.user, result.profile || null);
        hydrateUidRef.current = result.user.uid;
      } finally {
        setLoading(false);
      }
      return result;
    },
    [applyAuthenticatedProfile],
  );

  const signInWithGoogle = useCallback(async (idToken) => {
    const result = await AuthService.signInWithGoogle(idToken);
    return attachAuthResult(result);
  }, [attachAuthResult]);

  const sendOTP = useCallback(async (phoneNumber, options) => {
    return AuthService.sendOTP(phoneNumber, options);
  }, []);

  const verifyOTP = useCallback(
    async (confirmation, otpCode, options) => {
      const result = await AuthService.verifyOTP(confirmation, otpCode, options);
      return attachAuthResult(result);
    },
    [attachAuthResult],
  );

  const signUpWithEmail = useCallback(
    async (payload) => {
      const result = await AuthService.signUpWithEmail(payload);
      return attachAuthResult(result);
    },
    [attachAuthResult],
  );

  const signInWithEmail = useCallback(
    async (payload) => {
      const result = await AuthService.signInWithEmail(payload);
      return attachAuthResult(result);
    },
    [attachAuthResult],
  );

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
      // Optimistic UI — Home header must reflect avatar immediately
      if (updates && typeof updates === 'object') {
        setProfile((prev) => ({
          ...(prev || { uid: user.uid }),
          ...updates,
          updatedAt: Date.now(),
        }));
      }
      const result = await UserService.updateProfile(user.uid, updates);
      if (result.success) {
        setProfile((prev) => ({
          ...(prev || {}),
          ...(result.profile || {}),
          photoURL: result.profile?.photoURL || updates?.photoURL || prev?.photoURL || '',
          updatedAt: result.profile?.updatedAt || Date.now(),
        }));
        try {
          if (typeof updates?.photoURL === 'string' && updates.photoURL) {
            await user.updateProfile({ photoURL: updates.photoURL });
            await user.reload?.();
            const fresh = AuthService.getCurrentUser?.() || user;
            if (fresh) setUser(fresh);
          }
        } catch {
          /* non-blocking auth mirror */
        }
      }
      return result;
    },
    [user],
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
      hydrateUidRef.current = null;
      setUser(null);
      setProfile(null);
      setProfileReady(true);
      CrashlyticsService.clearUser();
    }
    return result;
  }, []);

  const displayName = useMemo(
    () =>
      user
        ? resolveDisplayName({ profile, user, fallback: 'Asset Owner' })
        : 'Guest',
    [profile, user],
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileReady,
      displayName,
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
      profileReady,
      displayName,
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
