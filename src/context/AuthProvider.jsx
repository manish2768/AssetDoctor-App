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
import { needsProfileSetup as checkProfileSetup, needsProfileOnboarding } from '../utils/profileSetup';
import { computeProfileCompletion, PROFILE_STATUS } from '../utils/profileCompletion';
import { resolveDisplayName } from '../utils/displayUserName';
import { loadLocalProfile, saveLocalProfile, clearLocalProfile, DEFAULT_PROFILE } from '../utils/userProfileStorage';
import { persistAuthSession, clearAuthSession, loadAuthSession } from '../services/authService';
import { ensureFirebaseApp, waitForFirebaseApp } from '../config/firebaseApp';

export { PROFILE_STATUS };

const AuthContext = createContext(null);

/** Hard cap for Firestore profile hydrate — paired with AuthBootGate 3s Retry UI. */
const PROFILE_HYDRATE_TIMEOUT_MS = 3000;

function withTimeout(promise, ms, label = 'timeout') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

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
  const [localProfile, setLocalProfile] = useState({ ...DEFAULT_PROFILE });
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [profileStatus, setProfileStatus] = useState(PROFILE_STATUS.IDLE);
  /** Logged-out users may Skip → browse Home without Auth welcome */
  const [allowGuestBrowse, setAllowGuestBrowse] = useState(false);
  /** Skip live subscribe until the first hydrate for this uid finishes */
  const hydrateUidRef = useRef(null);
  const profileRef = useRef(null);
  const localProfileRef = useRef(localProfile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    localProfileRef.current = localProfile;
  }, [localProfile]);

  // Hydrate device profile cache for Home greeting
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalProfile();
      if (!cancelled) setLocalProfile(local);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLocalProfile = useCallback(async () => {
    const local = await loadLocalProfile();
    setLocalProfile(local);
    setProfile((prev) => ({
      ...(prev || {}),
      ...local,
      name: local.name || prev?.name || '',
      photoURL: local.photoURL || prev?.photoURL || '',
      city: local.city || prev?.city || '',
    }));
    return local;
  }, []);

  const applyAuthenticatedProfile = useCallback((firebaseUser, nextProfile, { isReady = true } = {}) => {
    const local = localProfileRef.current || {};
    const authFallback = authFallbackProfile(firebaseUser) || {};
    const resolvedName =
      nextProfile?.fullName ||
      nextProfile?.name ||
      profileRef.current?.fullName ||
      profileRef.current?.name ||
      authFallback?.name ||
      local?.fullName ||
      local?.name ||
      (firebaseUser?.displayName ? String(firebaseUser.displayName).trim() : '');

    const resolvedPincode =
      nextProfile?.pinCode ||
      nextProfile?.pincode ||
      profileRef.current?.pinCode ||
      profileRef.current?.pincode ||
      local?.pinCode ||
      local?.pincode ||
      '';

    const merged = {
      ...(nextProfile || profileRef.current || authFallback || {}),
      fullName: resolvedName,
      name: resolvedName,
      pinCode: resolvedPincode,
      pincode: resolvedPincode,
      // Prefer Firebase Auth photoURL over stale local cache
      photoURL:
        nextProfile?.photoURL ||
        firebaseUser?.photoURL ||
        authFallback?.photoURL ||
        profileRef.current?.photoURL ||
        local?.photoURL ||
        '',
      email: nextProfile?.email || firebaseUser?.email || local?.email || '',
      phone:
        nextProfile?.phone ||
        nextProfile?.phoneNumber ||
        firebaseUser?.phoneNumber ||
        local?.phone ||
        '',
      city: nextProfile?.city || profileRef.current?.city || local?.city || '',
      state: nextProfile?.state || profileRef.current?.state || local?.state || '',
    };
    merged.phoneNumber = merged.phone;
    setProfile(merged);
    if (isReady) {
      setProfileReady(true);
      persistAuthSession(firebaseUser, merged)
        .then((saved) => {
          if (!saved?.profile) return;
          setLocalProfile((prev) => {
            const next = saved.profile;
            if (
              prev?.name === next.name &&
              prev?.photoURL === next.photoURL &&
              prev?.email === next.email &&
              (prev?.phone || prev?.phoneNumber) === (next.phone || next.phoneNumber) &&
              (prev?.pinCode || prev?.pincode) === (next.pinCode || next.pincode) &&
              prev?.city === next.city &&
              prev?.state === next.state
            ) {
              return prev;
            }
            return { ...prev, ...next };
          });
        })
        .catch(() => {});
    }
    return merged;
  }, []);

  useEffect(() => {
    let unsubAuth = () => {};
    let cancelled = false;

    (async () => {
      try {
        await waitForFirebaseApp({ timeoutMs: 10000, intervalMs: 75 });
        ensureFirebaseApp();
      } catch (e) {
        console.warn('[AssetDoctor] Firebase ensure on auth mount:', e?.message || e);
      }
      if (cancelled) return;

      loadAuthSession()
        .then((session) => {
          if (cancelled || !session) return;
          if (session.email || session.name || session.phone || session.photoURL) {
            setLocalProfile((prev) => ({
              ...prev,
              name: session.name || prev.name,
              email: session.email || prev.email,
              phone: session.phone || prev.phone,
              phoneNumber: session.phone || prev.phoneNumber,
              photoURL: session.photoURL || prev.photoURL,
            }));
          }
          const current = AuthService.getCurrentUser();
          if (current?.uid && (!session.uid || session.uid === current.uid)) {
            setUser(current);
          }
        })
        .catch(() => {});

      try {
        unsubAuth = AuthService.onAuthStateChanged(async (firebaseUser) => {
          if (cancelled) return;

          if (!firebaseUser) {
            hydrateUidRef.current = null;
            setUser(null);
            setProfile(null);
            setProfileReady(true);
            setProfileStatus(PROFILE_STATUS.IDLE);
            CrashlyticsService.clearUser();
            setLoading(false);
            return;
          }

          const sameUidAlreadyReady = hydrateUidRef.current === firebaseUser.uid;
          setUser(firebaseUser);
          CrashlyticsService.setUser(firebaseUser);

          // Avoid vault-gate flicker: only block UI on real auth transitions
          if (!sameUidAlreadyReady) {
            setLoading(true);
            setProfileReady(false);
            setProfileStatus(PROFILE_STATUS.LOADING);
            applyAuthenticatedProfile(firebaseUser, authFallbackProfile(firebaseUser), { isReady: false });
          }

          try {
            const synced = await withTimeout(
              UserService.syncUserToFirestore(firebaseUser),
              PROFILE_HYDRATE_TIMEOUT_MS,
              'profile_sync_timeout',
            );
            if (cancelled) return;
            const comp = computeProfileCompletion({ user: firebaseUser, profile: synced });
            const isEstablished = comp.isComplete || Boolean(synced?.profileSetupComplete) || !comp.needsOnboarding;
            setProfileStatus(isEstablished ? PROFILE_STATUS.FOUND_COMPLETE : PROFILE_STATUS.FOUND_INCOMPLETE);
            applyAuthenticatedProfile(firebaseUser, synced, { isReady: true });
            hydrateUidRef.current = firebaseUser.uid;
          } catch (error) {
            console.warn('[AssetDoctor] profile sync failed/timeout:', error?.message || error);
            try {
              const existing = await withTimeout(
                UserService.getProfile(firebaseUser.uid),
                Math.min(2000, PROFILE_HYDRATE_TIMEOUT_MS),
                'profile_get_timeout',
              );
              if (cancelled) return;
              const comp = computeProfileCompletion({ user: firebaseUser, profile: existing });
              const isEstablished = comp.isComplete || Boolean(existing?.profileSetupComplete) || !comp.needsOnboarding;
              setProfileStatus(isEstablished ? PROFILE_STATUS.FOUND_COMPLETE : PROFILE_STATUS.FOUND_INCOMPLETE);
              applyAuthenticatedProfile(firebaseUser, existing, { isReady: true });
            } catch {
              if (cancelled) return;
              setProfileStatus(PROFILE_STATUS.ERROR);
              applyAuthenticatedProfile(firebaseUser, authFallbackProfile(firebaseUser), { isReady: true });
            }
            hydrateUidRef.current = firebaseUser.uid;
          } finally {
            if (!cancelled) {
              setProfileReady(true);
              setLoading(false);
            }
          }
        });
      } catch (error) {
        console.warn('[AssetDoctor] Auth listener failed:', error?.message || error);
        setProfileStatus(PROFILE_STATUS.ERROR);
        setProfileReady(true);
        setLoading(false);
      }
    })();

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
        setProfile((prev) => prev || authFallbackProfile(user));
        return;
      }
      // Always keep Auth photoURL if Firestore photo is empty
      const merged = {
        ...next,
        photoURL: next.photoURL || user.photoURL || '',
        email: next.email || user.email || '',
        phone: next.phone || next.phoneNumber || user.phoneNumber || '',
      };
      merged.phoneNumber = merged.phone;
      setProfile((prev) => {
        if (prev?.profileSetupComplete && !next.profileSetupComplete && !next.pinCode && !next.pincode) {
          return prev;
        }
        return merged;
      });
      const comp = computeProfileCompletion({ user, profile: merged });
      const isEstablished = comp.isComplete || Boolean(merged?.profileSetupComplete) || !comp.needsOnboarding;
      setProfileStatus(isEstablished ? PROFILE_STATUS.FOUND_COMPLETE : PROFILE_STATUS.FOUND_INCOMPLETE);
      setProfileReady(true);
    });
  }, [user?.uid, user]);

  const attachAuthResult = useCallback(
    async (result) => {
      if (!result?.success || !result.user) return result;
      setLoading(true);
      setProfileReady(false);
      setProfileStatus(PROFILE_STATUS.LOADING);
      setUser(result.user);
      CrashlyticsService.setUser(result.user);
      // Instant credentials from Auth + any profile already on the result.
      // NEVER set isReady: true when falling back to bare authFallbackProfile!
      const initialReady = Boolean(result.profile?.profileSetupComplete || (result.profile?.name && result.profile?.pinCode));
      applyAuthenticatedProfile(result.user, result.profile || authFallbackProfile(result.user), { isReady: initialReady });
      try {
        let nextProfile = result.profile || null;
        if (!nextProfile) {
          nextProfile = await withTimeout(
            UserService.getProfile(result.user.uid),
            PROFILE_HYDRATE_TIMEOUT_MS,
            'post_login_get_timeout',
          );
        }
        if (!nextProfile) {
          nextProfile = await withTimeout(
            UserService.syncUserToFirestore(result.user),
            PROFILE_HYDRATE_TIMEOUT_MS,
            'post_login_sync_timeout',
          );
        }
        if (nextProfile) {
          const comp = computeProfileCompletion({ user: result.user, profile: nextProfile });
          const isEstablished = comp.isComplete || Boolean(nextProfile.profileSetupComplete) || !comp.needsOnboarding;
          setProfileStatus(isEstablished ? PROFILE_STATUS.FOUND_COMPLETE : PROFILE_STATUS.FOUND_INCOMPLETE);
          applyAuthenticatedProfile(result.user, nextProfile, { isReady: true });
        } else {
          setProfileStatus(PROFILE_STATUS.NOT_FOUND);
          applyAuthenticatedProfile(result.user, authFallbackProfile(result.user), { isReady: true });
        }
        hydrateUidRef.current = result.user.uid;
      } catch (error) {
        console.warn('[AssetDoctor] post-login profile hydrate:', error?.message || error);
        setProfileStatus(PROFILE_STATUS.ERROR);
        applyAuthenticatedProfile(result.user, result.profile || authFallbackProfile(result.user), { isReady: true });
        hydrateUidRef.current = result.user.uid;
      } finally {
        setProfileReady(true);
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

  const sendPasswordResetEmail = useCallback(async (email) => {
    return AuthService.sendPasswordResetEmail(email);
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user?.uid) {
        const localResult = await saveLocalProfile(updates || {});
        if (localResult.success) {
          setLocalProfile(localResult.profile);
          setProfile(localResult.profile);
        }
        Haptics.success();
        return localResult.success
          ? { success: true, profile: localResult.profile }
          : { success: false, error: localResult.error || 'Not signed in' };
      }

      const result = await UserService.updateProfile(user.uid, updates);
      if (result.success && result.profile) {
        await saveLocalProfile(result.profile).catch(() => {});
        setLocalProfile(result.profile);
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
        if (typeof updates?.name === 'string' && updates.name.trim()) {
          try {
            await user.updateProfile({ displayName: updates.name.trim() });
          } catch {
            /* non-blocking */
          }
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
      if (result.success && result.profile) {
        applyAuthenticatedProfile(user, result.profile, { isReady: true });
        setProfile(result.profile);
        setLocalProfile(result.profile);
        setProfileStatus(PROFILE_STATUS.FOUND_COMPLETE);
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
    [user, applyAuthenticatedProfile],
  );

  const profileHydrationPending = Boolean(
    loading ||
    (!profileReady && Boolean(user)) ||
    profileStatus === PROFILE_STATUS.LOADING
  );

  const profileCompletion = useMemo(
    () => computeProfileCompletion({ user, profile }),
    [profile, user],
  );

  const needsProfileOnboarding = useMemo(() => {
    if (profileHydrationPending || !user) return false;
    if (profileStatus === PROFILE_STATUS.LOADING) return false;
    if (profileStatus === PROFILE_STATUS.FOUND_COMPLETE) return false;
    if (profileStatus === PROFILE_STATUS.ERROR) return false;
    return profileCompletion.needsOnboarding;
  }, [profileHydrationPending, user, profileStatus, profileCompletion]);

  const needsProfileSetup = needsProfileOnboarding;

  useEffect(() => {
    if (!__DEV__) return;
    if (user?.uid) {
      console.log('[PROFILE_BOOT]', {
        authUserResolved: Boolean(user?.uid),
        canonicalProfileLoaded: Boolean(profileReady && profile),
        profileComplete: profileCompletion.isComplete,
        needsOnboarding: needsProfileOnboarding,
        hydrationPending: profileHydrationPending,
      });
    }
  }, [user?.uid, profileReady, profileCompletion.isComplete, needsProfileOnboarding, profileHydrationPending]);

  const enterGuestBrowse = useCallback(() => {
    setAllowGuestBrowse(true);
  }, []);

  const retryProfileHydrate = useCallback(async () => {
    const firebaseUser = AuthService.getCurrentUser() || user;
    if (!firebaseUser?.uid) {
      setLoading(false);
      setProfileReady(true);
      return { success: false, error: 'Not signed in' };
    }
    setLoading(true);
    setProfileReady(false);
    try {
      const synced = await withTimeout(
        UserService.syncUserToFirestore(firebaseUser),
        PROFILE_HYDRATE_TIMEOUT_MS,
        'profile_retry_timeout',
      );
      applyAuthenticatedProfile(firebaseUser, synced);
      hydrateUidRef.current = firebaseUser.uid;
      return { success: true };
    } catch (error) {
      applyAuthenticatedProfile(firebaseUser, authFallbackProfile(firebaseUser));
      hydrateUidRef.current = firebaseUser.uid;
      return { success: false, error: error?.message || 'Retry failed' };
    } finally {
      setProfileReady(true);
      setLoading(false);
    }
  }, [user, applyAuthenticatedProfile]);

  const signOut = useCallback(async () => {
    const result = await AuthService.signOut();
    hydrateUidRef.current = null;
    setUser(null);
    setProfile(null);
    setProfileReady(true);
    setLoading(false);
    setAllowGuestBrowse(false);
    CrashlyticsService.clearUser();
    try {
      await clearAuthSession({ keepLocalProfile: false });
    } catch {
      /* ignore */
    }
    try {
      setLocalProfile({ ...DEFAULT_PROFILE });
      await clearLocalProfile();
    } catch {
      setLocalProfile({ ...DEFAULT_PROFILE });
    }
    // Hard navigation reset → Login (AuthSwitch remounts Auth stack)
    try {
      const { resetToLogin } = require('../navigation/NavigationService');
      resetToLogin();
    } catch {
      /* container may remount via key */
    }
    return result?.success === false ? result : { success: true };
  }, []);

  const displayName = useMemo(() => {
    const fromProfile = resolveDisplayName({
      profile: profile || localProfile,
      user,
      fallback: '',
    });
    return (
      fromProfile ||
      localProfile?.name ||
      (user?.displayName ? String(user.displayName).trim() : '') ||
      (user ? 'Asset Owner' : '')
    );
  }, [profile, localProfile, user]);

  const value = useMemo(
    () => ({
      user,
      profile: (() => {
        const base = profile
          ? { ...localProfile, ...profile, name: profile.name || localProfile.name }
          : { ...localProfile };
        return {
          ...base,
          email: base.email || user?.email || localProfile?.email || '',
          phone:
            base.phone ||
            base.phoneNumber ||
            user?.phoneNumber ||
            localProfile?.phone ||
            '',
          phoneNumber:
            base.phoneNumber ||
            base.phone ||
            user?.phoneNumber ||
            localProfile?.phoneNumber ||
            '',
          photoURL: base.photoURL || user?.photoURL || localProfile?.photoURL || '',
        };
      })(),
      localProfile,
      loading,
      profileReady,
      displayName,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendEmailVerification,
      sendPasswordResetEmail,
      reloadUser,
      sendOTP,
      verifyOTP,
      updateProfile,
      completeProfileSetup,
      refreshLocalProfile,
      retryProfileHydrate,
      signOut,
      enterGuestBrowse,
      allowGuestBrowse,
      isAuthenticated: Boolean(user?.uid),
      needsProfileSetup,
      needsProfileOnboarding,
      profileHydrationPending,
      profileCompletion,
      profileStatus,
      PROFILE_STATUS,
      emailVerified: Boolean(user?.emailVerified || profile?.emailVerified),
    }),
    [
      user,
      profile,
      localProfile,
      loading,
      profileReady,
      profileStatus,
      displayName,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendEmailVerification,
      sendPasswordResetEmail,
      reloadUser,
      sendOTP,
      verifyOTP,
      updateProfile,
      completeProfileSetup,
      refreshLocalProfile,
      retryProfileHydrate,
      signOut,
      enterGuestBrowse,
      allowGuestBrowse,
      needsProfileSetup,
      needsProfileOnboarding,
      profileHydrationPending,
      profileCompletion,
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
