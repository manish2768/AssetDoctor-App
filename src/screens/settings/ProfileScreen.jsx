/**
 * Profile & Address — edit/update identity + vaulted asset stats.
 * Persists to AsyncStorage key `user_profile_data` so Home greeting updates instantly.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { Screen, GlassCard, GlassInput, GlassButton, BrandFooter } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { openLogin } from '../../navigation/authGate';
import { Haptics } from '../../services/haptics';
import { uploadProfilePhoto } from '../../services/user/ProfilePhotoService';
import { normalizePhone } from '../../utils/profileSetup';
import { calculateHealthScore } from '../../utils/healthScore';
import {
  DEFAULT_PROFILE,
  loadLocalProfile,
  saveLocalProfile,
} from '../../utils/userProfileStorage';
import { AssetDoctorProtectedBadge } from '../../components/trust/AssetDoctorProtectedBadge';
import {
  profileProtectionChecklist,
  calculateProtectionScore,
  resolveProtectionBadgeState,
} from '../../trust/protectionStatus';
import { appVersionLabel } from '../../utils/appInfo';


const DEFAULT_AVATARS = [
  { id: 'default:teal', color: '#0D9488', label: 'Teal' },
  { id: 'default:blue', color: '#2563EB', label: 'Blue' },
  { id: 'default:amber', color: '#D97706', label: 'Amber' },
  { id: 'default:rose', color: '#E11D48', label: 'Rose' },
];

function isDefaultAvatar(uri) {
  return typeof uri === 'string' && uri.startsWith('default:');
}

function avatarColor(uri) {
  return DEFAULT_AVATARS.find((a) => a.id === uri)?.color || COLORS.emerald;
}

function initials(name) {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ProfileScreen({ navigation }) {
  const {
    profile,
    user,
    updateProfile,
    isAuthenticated,
    signOut,
    displayName: authDisplayName,
    refreshLocalProfile,
    sendOTP,
    verifyOTP,
  } = useAuth();
  const { assets, isGuestDemo } = useAssets();
  const ui = useUiFeedback();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(DEFAULT_PROFILE.name);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [gender, setGender] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpConfirmation, setOtpConfirmation] = useState(null);

  const vaultedCount = useMemo(
    () => assets.filter((a) => !a.isDemo && !a.deletedAt).length,
    [assets],
  );

  const vaultHealth = useMemo(() => {
    const list = assets.filter((a) => !a.isDemo && !a.deletedAt);
    let total = 0;
    let n = 0;
    for (const a of list) {
      const res = calculateHealthScore(a);
      const v = typeof res === 'number' ? res : res?.score;
      if (Number.isFinite(v)) {
        total += v;
        n += 1;
      }
    }
    return n ? Math.round(total / n) : null;
  }, [assets]);

  const protectionIdentity = useMemo(() => {
    const userShape = {
      name: profile?.name || name,
      displayName: authDisplayName,
      phone: profile?.phone || profile?.phoneNumber || mobile,
      phoneNumber: profile?.phoneNumber || mobile,
      whatsappOptIn: profile?.whatsappOptIn,
      pincode: profile?.pincode || pincode,
      city: profile?.city || city,
    };
    const list = (assets || []).filter((a) => !a.isDemo && !a.deletedAt);
    return {
      checklist: profileProtectionChecklist(userShape, list, []),
      score: calculateProtectionScore({ user: userShape, assets: list, documents: [] }),
      badge: resolveProtectionBadgeState({ user: userShape, documents: [] }),
    };
  }, [profile, name, authDisplayName, mobile, pincode, city, assets]);

  const hydrateFromSources = async () => {
    const local = await loadLocalProfile();
    const authPhone = user?.phoneNumber || '';
    const authEmail = user?.email || '';
    setName(profile?.name || local.name || user?.displayName || DEFAULT_PROFILE.name);
    setMobile(
      profile?.phone ||
        profile?.phoneNumber ||
        authPhone ||
        local.phone ||
        local.phoneNumber ||
        '',
    );
    setEmail(profile?.email || authEmail || local.email || '');
    setCity(profile?.city || local.city || '');
    setAddress(profile?.address || local.address || '');
    setPincode(profile?.pincode || local.pincode || '');
    setPhotoURL(user?.photoURL || profile?.photoURL || local.photoURL || '');
    setGender(String(profile?.gender || local.gender || '').toLowerCase());
  };

  useEffect(() => {
    hydrateFromSources().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user?.uid, user?.photoURL, user?.email, user?.phoneNumber, isAuthenticated]);

  const applyPickedUri = async (uri) => {
    if (!uri) return;
    setBusy(true);
    try {
      let nextPhoto = uri;
      if (isAuthenticated && user?.uid) {
        const uploaded = await uploadProfilePhoto(user.uid, uri);
        if (uploaded.success && uploaded.downloadUrl) {
          nextPhoto = uploaded.downloadUrl;
          await updateProfile({ photoURL: nextPhoto });
        } else if (!uploaded.success) {
          // Keep local file URI so avatar still updates offline
          console.warn('[Profile] upload failed, using local uri:', uploaded.error);
        }
      }
      setPhotoURL(nextPhoto);
      await saveLocalProfile({ photoURL: nextPhoto, name, email, phone: mobile, city, address, pincode, gender });
      refreshLocalProfile?.();
      Haptics.success();
    } catch (error) {
      ui.error('Photo', error?.message || 'Could not update photo');
    } finally {
      setBusy(false);
      setPhotoSheet(false);
    }
  };

  const onPickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      ui.info('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images || ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    await applyPickedUri(picked.assets[0].uri);
  };

  const onPickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      ui.info('Permission needed', 'Allow camera access to take a profile photo.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images || ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (shot.canceled || !shot.assets?.[0]?.uri) return;
    await applyPickedUri(shot.assets[0].uri);
  };

  const onSave = async () => {
    if (!name.trim()) {
      ui.info('Profile', 'Full name is required.');
      return;
    }
    const cleanPhone = normalizePhone(mobile);
    const payload = {
      name: name.trim() || DEFAULT_PROFILE.name,
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      email: email.trim(),
      city: city.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
      gender: gender || '',
      photoURL: photoURL || '',
      profileSetupComplete: true,
    };

    setBusy(true);
    const local = await saveLocalProfile(payload);
    if (!local.success) {
      setBusy(false);
      ui.error('Profile', local.error || 'Could not save locally');
      return;
    }

    if (isAuthenticated) {
      const result = await updateProfile(payload);
      setBusy(false);
      if (!result?.success) {
        // Local save already succeeded — still refresh greeting
        refreshLocalProfile?.();
        ui.info(
          'Saved on device',
          result?.error
            ? `Cloud sync failed (${result.error}). Local profile still updated.`
            : 'Local profile updated.',
        );
        setEditing(false);
        return;
      }
    } else {
      setBusy(false);
    }

    refreshLocalProfile?.();
    Haptics.success();
    setEditing(false);
    ui.success('Profile details updated.');
  };

  const onSendLinkOtp = async () => {
    if (!isAuthenticated) {
      openLogin(navigation);
      return;
    }
    const cleanPhone = normalizePhone(mobile);
    if (!cleanPhone || cleanPhone.length < 10) {
      ui.info('Mobile', 'Enter a valid mobile number first.');
      return;
    }
    setOtpBusy(true);
    try {
      const result = await sendOTP(cleanPhone, { mode: 'link' });
      setOtpBusy(false);
      if (!result?.success) {
        ui.error('OTP', result?.error || 'Could not send OTP');
        return;
      }
      setOtpConfirmation(result.confirmation);
      setOtpSent(true);
      Haptics.success();
      ui.info(
        'OTP sent',
        result.mode === 'link'
          ? 'Enter the code to link this mobile to your Google/email account.'
          : 'Enter the code to open the vault for this mobile.',
      );
    } catch (e) {
      setOtpBusy(false);
      ui.error('OTP', e?.message || 'Could not send OTP');
    }
  };

  const onVerifyLinkOtp = async () => {
    if (!otpConfirmation) {
      ui.info('OTP', 'Request a new OTP first.');
      return;
    }
    setOtpBusy(true);
    try {
      const result = await verifyOTP(otpConfirmation, otpCode, { mode: 'link' });
      setOtpBusy(false);
      if (!result?.success) {
        ui.error('OTP', result?.error || 'Invalid OTP');
        return;
      }
      const linkedPhone = result.user?.phoneNumber || normalizePhone(mobile);
      if (linkedPhone) {
        setMobile(linkedPhone);
        await saveLocalProfile({
          phone: linkedPhone,
          phoneNumber: linkedPhone,
        });
        refreshLocalProfile?.();
      }
      setOtpSent(false);
      setOtpCode('');
      setOtpConfirmation(null);
      Haptics.success();
      ui.success(
        result.message ||
          (result.merged
            ? 'Opened the vault for this mobile number.'
            : 'Mobile linked to your account.'),
      );
    } catch (e) {
      setOtpBusy(false);
      ui.error('OTP', e?.message || 'Could not verify OTP');
    }
  };

  const shownName =
    name || authDisplayName || profile?.name || DEFAULT_PROFILE.name || 'Asset Owner';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Account</Text>

        <GlassCard glow style={{ marginTop: 10 }}>
          <View style={styles.avatarRow}>
            <Pressable
              onPress={() => {
                Haptics.tap();
                setPhotoSheet(true);
              }}
              style={styles.avatarFrame}
            >
              {photoURL && !isDefaultAvatar(photoURL) ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImg} />
              ) : photoURL && isDefaultAvatar(photoURL) ? (
                <View style={[styles.avatarImg, { backgroundColor: avatarColor(photoURL), alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[styles.avatarText, { color: '#fff' }]}>{initials(shownName)}</Text>
                </View>
              ) : (
                <Text style={styles.avatarText}>{initials(shownName)}</Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcome}>{greeting()}</Text>
              <Text style={styles.name}>{shownName}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {email || mobile || city || 'Tap Edit Profile to update'}
              </Text>
            </View>
          </View>

          <GlassButton
            title={editing ? 'Close editor' : 'Edit Profile'}
            variant={editing ? 'ghost' : undefined}
            style={{ marginTop: 14 }}
            onPress={() => {
              Haptics.select();
              setEditing((v) => !v);
            }}
          />

          {isAuthenticated && !isGuestDemo ? (
            <View style={styles.statRow}>
              <View style={styles.statChip}>
                <Text style={styles.statNum}>{vaultedCount}</Text>
                <Text style={styles.statLabel}>Assets</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statNum}>{isAuthenticated ? 'On' : 'Local'}</Text>
                <Text style={styles.statLabel}>Encrypted sync</Text>
              </View>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={{ marginTop: 12 }}>
          <Text style={styles.editTitle}>Your Protection Identity</Text>
          <View style={{ marginTop: 8 }}>
            <AssetDoctorProtectedBadge state={protectionIdentity.badge} />
          </View>
          <Text style={[styles.sub, { marginTop: 10 }]}>
            Protection Score {protectionIdentity.score.display}
          </Text>
          {protectionIdentity.checklist.items.map((item) => (
            <Text key={item.id} style={[styles.rowValue, { marginTop: 6 }]}>
              {item.complete ? 'Complete' : 'Needs setup'} · {item.label}
            </Text>
          ))}
          <View style={styles.statRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{protectionIdentity.checklist.assetsProtected}</Text>
              <Text style={styles.statLabel}>Assets Protected</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{protectionIdentity.checklist.documentsProtected}</Text>
              <Text style={styles.statLabel}>Documents Protected</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{protectionIdentity.checklist.upcomingAttention}</Text>
              <Text style={styles.statLabel}>Upcoming Attention</Text>
            </View>
          </View>
        </GlassCard>

        {editing ? (
          <GlassCard style={{ marginTop: 12 }}>
            <Text style={styles.editTitle}>Edit your details</Text>
            <GlassInput
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder={DEFAULT_PROFILE.name}
            />
            <GlassInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@email.com"
            />
            <GlassInput
              label="Phone Number"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              placeholder="+91 …"
            />
            {isAuthenticated ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.sub}>
                  Verify mobile with OTP to link Google/email + phone on one vault (no “already linked” block).
                </Text>
                {!otpSent ? (
                  <GlassButton
                    title="Verify mobile (OTP)"
                    variant="ghost"
                    loading={otpBusy}
                    style={{ marginTop: 8 }}
                    onPress={onSendLinkOtp}
                  />
                ) : (
                  <>
                    <GlassInput
                      label="OTP"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      placeholder="6-digit code"
                      maxLength={6}
                    />
                    <GlassButton
                      title="Confirm & link"
                      loading={otpBusy}
                      onPress={onVerifyLinkOtp}
                    />
                  </>
                )}
              </View>
            ) : null}
            <GlassInput
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Lucknow"
            />
            <Text style={styles.genderLabel}>Gender (optional)</Text>
            <View style={styles.genderRow}>
              {[
                { id: 'male', label: 'Male · भैया' },
                { id: 'female', label: 'Female · दीदी' },
                { id: 'other', label: 'Other · जी' },
              ].map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    Haptics.select();
                    setGender(opt.id);
                  }}
                  style={[styles.genderChip, gender === opt.id && styles.genderChipOn]}
                >
                  <Text style={[styles.genderChipText, gender === opt.id && styles.genderChipTextOn]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <GlassInput
              label="Home Address"
              value={address}
              onChangeText={setAddress}
              placeholder="House / street / landmark"
              multiline
            />
            <GlassInput
              label="Pincode"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              placeholder="e.g. 226010"
              maxLength={10}
            />
            
            <Text style={styles.genderLabel}>Choose avatar</Text>
            <View style={styles.avatarPickRow}>
              {DEFAULT_AVATARS.map((av) => (
                <Pressable
                  key={av.id}
                  onPress={() => {
                    Haptics.select();
                    setPhotoURL(av.id);
                  }}
                  style={[
                    styles.avatarPick,
                    { backgroundColor: av.color },
                    photoURL === av.id && styles.avatarPickOn,
                  ]}
                  accessibilityLabel={`Avatar ${av.label}`}
                >
                  <Text style={styles.avatarPickText}>{av.label[0]}</Text>
                </Pressable>
              ))}
            </View>
            <GlassButton
              title="Upload custom photo"
              variant="ghost"
              style={{ marginBottom: 8 }}
              onPress={() => {
                Haptics.tap();
                setPhotoSheet(true);
              }}
            />

            <GlassButton title="Save Profile" loading={busy} onPress={onSave} />
            {!isAuthenticated ? (
              <Pressable
                onPress={() => openLogin(navigation)}
                style={{ marginTop: 10 }}
              >
                <Text style={styles.sub}>
                  Signed out — changes save on this device. Sign in to sync to cloud →
                </Text>
              </Pressable>
            ) : null}
          </GlassCard>
        ) : (
          <GlassCard style={{ marginTop: 12 }}>
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue}>{shownName}</Text>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{email || '—'}</Text>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>{mobile || 'Add phone'}</Text>
            <Text style={styles.rowLabel}>City</Text>
            <Text style={styles.rowValue}>{city || '—'}</Text>
          </GlassCard>
        )}

        <View style={styles.scoreWrap}>
          <Text style={styles.scoreLabel}>Asset Health</Text>
          <Text style={styles.scoreValue}>
            {vaultHealth == null ? '—' : vaultHealth}
            {vaultHealth != null ? <Text style={styles.scoreUnit}> / 100</Text> : null}
          </Text>
          <Text style={styles.scoreHint}>
            {vaultHealth == null
              ? 'Add assets to see Asset Health from real documents and coverage.'
              : 'Average Asset Health of assets in your vault. Separate from Protection Score.'}
          </Text>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>ACCOUNT</Text>
          <Pressable
            style={styles.settingItem}
            onPress={() => {
              Haptics.tap();
              navigation?.navigate?.('SettingsHome');
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.familyTitle}>App Lock & Security</Text>
              <Text style={styles.sub}>Biometrics, passcode protection</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>PREFERENCES</Text>
          <Pressable
            style={styles.settingItem}
            onPress={() => {
              Haptics.tap();
              navigation?.navigate?.('NotificationCenter');
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.familyTitle}>Alerts & Reminders</Text>
              <Text style={styles.sub}>Manage expiry and service notices</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>VAULT</Text>
          <Pressable
            style={styles.settingItem}
            onPress={() => {
              Haptics.tap();
              navigation?.navigate?.('PrivacySecurity');
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.familyTitle}>Privacy & Trust Center</Text>
              <Text style={styles.sub}>How your data, documents, and notifications are handled</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>FEEDBACK & SUPPORT</Text>
          <Pressable
            style={styles.settingItem}
            onPress={() => {
              Haptics.tap();
              navigation?.navigate?.('ReportIssue');
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.familyTitle}>Feedback / Report Bug</Text>
              <Text style={styles.sub}>Share ideas or report an issue directly</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>ABOUT</Text>
          <Pressable
            style={styles.settingItem}
            onPress={() => {
              Haptics.tap();
              navigation?.navigate?.('About');
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.familyTitle}>About Asset Doctor</Text>
              <Text style={styles.sub}>{appVersionLabel()}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {isAuthenticated ? (
          <GlassButton
            title="Logout"
            variant="danger"
            style={{ marginTop: 16 }}
            onPress={async () => {
              Haptics.tap();
              const ok = await ui.confirm({
                title: 'Logout',
                message: 'Sign out so you can switch accounts?',
                confirmLabel: 'Logout',
                destructive: true,
              });
              if (!ok) return;
              const result = await Promise.race([
                signOut(),
                new Promise((resolve) => setTimeout(() => resolve({ success: true }), 6000)),
              ]);
              if (result?.success === false) {
                ui.error('Logout', result.error || 'Could not sign out');
                return;
              }
              Haptics.success();
              // RootNavigator remounts AuthWelcome (Google / Mobile / Guest)
            }}
          />
        ) : (
          <GlassButton
            title="Sign in / Switch account"
            style={{ marginTop: 16 }}
            onPress={() => {
              Haptics.tap();
              openLogin(navigation);
            }}
          />
        )}

        <BrandFooter />
      </ScrollView>

      <Modal visible={photoSheet} transparent animationType="fade" onRequestClose={() => setPhotoSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPhotoSheet(false)}>
          <View style={styles.sheetCard}>
            <Text style={styles.editTitle}>Update profile photo</Text>
            <GlassButton title="Take photo" onPress={onPickFromCamera} loading={busy} />
            <GlassButton
              title="Choose from gallery"
              variant="ghost"
              style={{ marginTop: 10 }}
              onPress={onPickFromGallery}
              loading={busy}
            />

            <Text style={[styles.genderLabel, { marginTop: 8 }]}>Or pick a default</Text>
            <View style={styles.avatarPickRow}>
              {DEFAULT_AVATARS.map((av) => (
                <Pressable
                  key={av.id}
                  onPress={async () => {
                    Haptics.select();
                    setPhotoURL(av.id);
                    await saveLocalProfile({ photoURL: av.id, name, email, phone: mobile });
                    refreshLocalProfile?.();
                    setPhotoSheet(false);
                    Haptics.success();
                  }}
                  style={[styles.avatarPick, { backgroundColor: av.color }, photoURL === av.id && styles.avatarPickOn]}
                >
                  <Text style={styles.avatarPickText}>{av.label[0]}</Text>
                </Pressable>
              ))}
            </View>

            <GlassButton
              title="Cancel"
              variant="ghost"
              style={{ marginTop: 10 }}
              onPress={() => setPhotoSheet(false)}
            />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 48 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  editTitle: { color: COLORS.text, fontWeight: '800', fontSize: 15, marginBottom: 8 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarFrame: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(0,245,160,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 64, height: 64 },
  avatarText: { color: COLORS.emerald, fontWeight: '900', fontSize: 18 },
  welcome: { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  name: { color: COLORS.text, fontWeight: '900', fontSize: 18, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
  statChip: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  statNum: { color: COLORS.emerald, fontWeight: '900', fontSize: 20 },
  statLabel: { color: COLORS.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  rowLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 10 },
  rowValue: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  aboutLink: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.35)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.emerald,
    backgroundColor: 'rgba(0,245,160,0.06)',
  },
  familyTitle: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  genderLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  genderChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  genderChipOn: {
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(0,245,160,0.12)',
  },
  genderChipText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  genderChipTextOn: { color: COLORS.emerald },
  scoreWrap: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(13,148,136,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.25)',
  },
  scoreLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  scoreValue: { color: COLORS.emerald, fontSize: 28, fontWeight: '900', marginTop: 4 },
  scoreUnit: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  scoreHint: { color: COLORS.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  sectionContainer: { marginTop: 14 },
  sectionHeading: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6, paddingHorizontal: 4 },
  settingItem: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: { color: COLORS.muted, fontSize: 20, fontWeight: '700', marginLeft: 8 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  avatarPickRow: { flexDirection: 'row', gap: 10, marginBottom: 12, marginTop: 6 },
  avatarPick: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarPickOn: { borderColor: COLORS.text },
  avatarPickText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
