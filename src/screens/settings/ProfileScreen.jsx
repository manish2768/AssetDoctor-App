/**
 * Profile & Address — view/update identity + vaulted asset stats
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { Screen, GlassCard, GlassInput, GlassButton, BrandFooter } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { openLogin } from '../../navigation/authGate';
import { Haptics } from '../../services/haptics';
import { uploadProfilePhoto } from '../../services/user/ProfilePhotoService';
import { normalizePhone } from '../../utils/profileSetup';

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
    loading: authLoading,
  } = useAuth();
  const { assets, isGuestDemo } = useAssets();
  const [name, setName] = useState(profile?.name || '');
  const [mobile, setMobile] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [pincode, setPincode] = useState(profile?.pincode || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [gender, setGender] = useState(String(profile?.gender || '').toLowerCase());
  const [busy, setBusy] = useState(false);

  const vaultedCount = useMemo(
    () => assets.filter((a) => !a.isDemo && !a.deletedAt).length,
    [assets],
  );

  useEffect(() => {
    setName(profile?.name || '');
    setMobile(profile?.phone || profile?.phoneNumber || '');
    setEmail(profile?.email || user?.email || '');
    setAddress(profile?.address || '');
    setPincode(profile?.pincode || '');
    setPhotoURL(profile?.photoURL || user?.photoURL || '');
    setGender(String(profile?.gender || '').toLowerCase());
  }, [profile, user?.photoURL, user?.email]);

  const onPickPhoto = async () => {
    if (!isAuthenticated) {
      openLogin(navigation);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setBusy(true);
    const uploaded = await uploadProfilePhoto(user.uid, picked.assets[0].uri);
    if (!uploaded.success) {
      setBusy(false);
      Alert.alert('Upload failed', uploaded.error);
      return;
    }
    const result = await updateProfile({ photoURL: uploaded.downloadUrl });
    setBusy(false);
    if (result.success) {
      setPhotoURL(uploaded.downloadUrl);
      Haptics.success();
    } else {
      Alert.alert('Profile', result.error || 'Could not save photo');
    }
  };

  const onSave = async () => {
    if (!isAuthenticated) {
      openLogin(navigation);
      return;
    }
    if (!name.trim()) {
      Alert.alert('Profile', 'Full name is required.');
      return;
    }
    const cleanPhone = normalizePhone(mobile);
    setBusy(true);
    const result = await updateProfile({
      name: name.trim(),
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      email: email.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
      gender: gender || '',
      profileSetupComplete: true,
    });
    setBusy(false);
    if (!result?.success) {
      Alert.alert('Profile', result?.error || 'Could not save');
      return;
    }
    Haptics.success();
    Alert.alert('Saved', 'Profile details updated.');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Profile Settings</Text>

        <GlassCard glow style={{ marginTop: 10 }}>
          <View style={styles.avatarRow}>
            <Pressable onPress={onPickPhoto} style={styles.avatarFrame}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>
                  {initials(isAuthenticated ? name || profile?.name : 'Guest')}
                </Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcome}>{greeting()}</Text>
              <Text style={styles.name}>
                {authLoading
                  ? 'Loading…'
                  : isAuthenticated
                    ? name || authDisplayName || 'Asset Owner'
                    : 'Guest'}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {authLoading
                  ? 'Fetching your profile…'
                  : isAuthenticated
                    ? user?.email || mobile || '—'
                    : 'Sign in to sync profile'}
              </Text>
            </View>
          </View>

          {isAuthenticated && !isGuestDemo ? (
            <View style={styles.statRow}>
              <View style={styles.statChip}>
                <Text style={styles.statNum}>{vaultedCount}</Text>
                <Text style={styles.statLabel}>Vaulted assets</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statNum}>🔒</Text>
                <Text style={styles.statLabel}>Encrypted sync</Text>
              </View>
            </View>
          ) : null}
        </GlassCard>

        {!isAuthenticated ? (
          <GlassCard style={{ marginTop: 12 }}>
            <Text style={styles.sub}>Browsing as guest. Sign in to edit and sync your profile.</Text>
            <GlassButton title="Sign in" style={{ marginTop: 12 }} onPress={() => openLogin(navigation)} />
          </GlassCard>
        ) : (
          <GlassCard style={{ marginTop: 12 }}>
            <GlassInput label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
            <GlassInput
              label="Email ID"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@email.com"
            />
            <GlassInput
              label="Primary Mobile Number"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              placeholder="+91 …"
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
              placeholder="House / street / city"
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
            <GlassButton title="Save Profile Details" loading={busy} onPress={onSave} />

            <View style={styles.scoreWrap}>
              <Text style={styles.scoreLabel}>Vault Protection Score</Text>
              <Text style={styles.scoreValue}>
                {Math.min(100, Math.round(vaultedCount * 12 + (pincode ? 8 : 0) + (address ? 8 : 0) + (mobile ? 10 : 0) + (name ? 10 : 0)))}
                <Text style={styles.scoreUnit}> / 100</Text>
              </Text>
              <Text style={styles.scoreHint}>
                Completing profile + vaulting assets raises your protection score.
              </Text>
            </View>
          </GlassCard>
        )}

        <Pressable
          style={styles.aboutLink}
          onPress={() => {
            Haptics.tap();
            navigation?.navigate?.('ReportIssue');
          }}
        >
          <Text style={styles.familyTitle}>Report issue / Feedback</Text>
          <Text style={styles.sub}>Crash, bug, or idea — reach the team →</Text>
        </Pressable>

        <Pressable
          style={styles.aboutLink}
          onPress={() => {
            Haptics.tap();
            navigation?.navigate?.('About');
          }}
        >
          <Text style={styles.familyTitle}>About Us</Text>
          <Text style={styles.sub}>{BRAND.creatorCredit} — story & vision →</Text>
        </Pressable>

        {isAuthenticated ? (
          <GlassButton
            title="Sign out"
            variant="danger"
            style={{ marginTop: 16 }}
            onPress={async () => {
              Haptics.tap();
              await signOut();
            }}
          />
        ) : null}

        <BrandFooter />
      </ScrollView>
    </Screen>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: 48 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
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
});
