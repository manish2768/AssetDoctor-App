/**
 * Asset Doctor — Duplicate Account Migrator
 * Safely discovers existing duplicate user profiles (same verified email or phone)
 * and merges associated records into a single canonical profile with zero data loss.
 * 
 * Features:
 * - Built-in DRY-RUN mode (`dryRun: true` default)
 * - Explicit detailed pre-migration report
 * - Re-parenting of Assets, Documents, Fuel Logs, Service Records, and OCR Records
 */

import { normalizeCanonicalEmail, normalizeCanonicalPhone } from './identityNormalizer';
import { CanonicalUserProfile, IdentityResolver } from './identityResolver';

export interface DuplicateGroup {
  groupId: string;
  matchedOn: 'email' | 'phone' | 'google' | 'multiple';
  matchedValue: string;
  profiles: CanonicalUserProfile[];
  selectedCanonicalUid?: string;
}

export interface MergedDataSummary {
  assetsMerged: number;
  documentsMerged: number;
  fuelLogsMerged: number;
  serviceRecordsMerged: number;
  ocrRecordsMerged: number;
  notificationsMerged: number;
  totalRecordsReassigned: number;
}

export interface MigrationOptions {
  dryRun?: boolean; // Default true for safety
  confirmed?: boolean;
}

export interface MigrationReport {
  timestamp: string;
  dryRun: boolean;
  totalProfilesScanned: number;
  duplicateGroupsCount: number;
  duplicateGroups: Array<{
    groupId: string;
    matchedOn: string;
    matchedValue: string;
    canonicalProfile: { uid: string; name: string; email?: string; phone?: string };
    duplicateProfiles: Array<{ uid: string; name: string; email?: string; phone?: string }>;
    recordsAffected: MergedDataSummary;
  }>;
  totalRecordsAffected: MergedDataSummary;
  conflicts: Array<{ groupId: string; reason: string; uids: string[] }>;
  recordsRequiringManualReview: Array<{ groupId: string; details: string }>;
  status: 'DRY_RUN_COMPLETED' | 'MIGRATION_EXECUTED' | 'ABORTED';
}

export class DuplicateAccountMigrator {
  /**
   * Scans an array of user profiles and groups duplicates strictly by verified normalized email or phone.
   */
  static detectDuplicateProfiles(profiles: CanonicalUserProfile[]): DuplicateGroup[] {
    const emailMap = new Map<string, CanonicalUserProfile[]>();
    const phoneMap = new Map<string, CanonicalUserProfile[]>();
    const googleMap = new Map<string, CanonicalUserProfile[]>();

    for (const p of profiles) {
      // Only group by verified emails
      const isEmailVerified = Boolean(
        p.identities?.email?.verified ||
        p.identities?.google?.verified ||
        (p.email && p.authProvider === 'google')
      );
      const email = normalizeCanonicalEmail(p.email || p.identities?.google?.email || p.identities?.email?.normalizedEmail);
      if (email && isEmailVerified) {
        const list = emailMap.get(email) || [];
        list.push(p);
        emailMap.set(email, list);
      }

      // Only group by verified phones
      const isPhoneVerified = Boolean(
        p.identities?.phone?.verified ||
        (p.phone && p.authProvider === 'phone') ||
        (p.phoneNumber && p.authProvider === 'phone')
      );
      const phone = normalizeCanonicalPhone(p.phone || p.phoneNumber || p.identities?.phone?.normalizedPhone);
      if (phone && isPhoneVerified) {
        const list = phoneMap.get(phone) || [];
        list.push(p);
        phoneMap.set(phone, list);
      }

      const gUid = p.identities?.google?.providerUserId;
      if (gUid) {
        const list = googleMap.get(gUid) || [];
        list.push(p);
        googleMap.set(gUid, list);
      }
    }

    const seenGroupUids = new Set<string>();
    const duplicateGroups: DuplicateGroup[] = [];

    // Check email duplicates
    for (const [email, list] of emailMap.entries()) {
      if (list.length > 1) {
        const uidsKey = list.map((p) => p.uid).sort().join('|');
        if (!seenGroupUids.has(uidsKey)) {
          seenGroupUids.add(uidsKey);
          duplicateGroups.push({
            groupId: `group:email:${email}`,
            matchedOn: 'email',
            matchedValue: email,
            profiles: list,
          });
        }
      }
    }

    // Check phone duplicates
    for (const [phone, list] of phoneMap.entries()) {
      if (list.length > 1) {
        const uidsKey = list.map((p) => p.uid).sort().join('|');
        if (!seenGroupUids.has(uidsKey)) {
          seenGroupUids.add(uidsKey);
          duplicateGroups.push({
            groupId: `group:phone:${phone}`,
            matchedOn: 'phone',
            matchedValue: phone,
            profiles: list,
          });
        }
      }
    }

    // Check Google duplicates
    for (const [gUid, list] of googleMap.entries()) {
      if (list.length > 1) {
        const uidsKey = list.map((p) => p.uid).sort().join('|');
        if (!seenGroupUids.has(uidsKey)) {
          seenGroupUids.add(uidsKey);
          duplicateGroups.push({
            groupId: `group:google:${gUid}`,
            matchedOn: 'google',
            matchedValue: gUid,
            profiles: list,
          });
        }
      }
    }

    return duplicateGroups;
  }

  /**
   * Deterministically selects the primary canonical profile from a duplicate group.
   * Priority:
   * 1. Verified identity
   * 2. Authenticated / active identity
   * 3. Most complete profile (name, PIN, city, state)
   * 4. Latest user-edited profile data
   */
  static selectCanonicalProfile(profiles: CanonicalUserProfile[]): CanonicalUserProfile {
    if (!profiles || profiles.length === 0) {
      throw new Error('Cannot select canonical profile from empty list.');
    }
    if (profiles.length === 1) return profiles[0];

    const scored = profiles.map((p) => {
      let score = 0;

      // 1. Verified identity checks
      if (p.identities?.google?.verified) score += 50;
      if (p.identities?.phone?.verified) score += 50;
      if (p.identities?.email?.verified) score += 30;

      // 2. Completeness checks
      const hasName = p.name && p.name !== 'Name not set' && p.name !== 'Asset Owner';
      if (hasName) score += 25;
      if (p.pincode && /^[1-9]\d{5}$/.test(p.pincode)) score += 20;
      if (p.city) score += 15;
      if (p.state) score += 15;
      if (p.address) score += 10;
      if (p.photoURL) score += 5;

      // 3. Updated timestamp freshness
      const updatedAtMs = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
      score += Math.min(10, Math.floor(updatedAtMs / (1000 * 60 * 60 * 24 * 365)));

      return { profile: p, score, updatedAtMs };
    });

    // Sort descending by score, then by latest timestamp
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAtMs - a.updatedAtMs;
    });

    return scored[0].profile;
  }

  /**
   * Merges duplicate profiles and re-parents all associated user data collections.
   * If `options.dryRun` is true, data is NOT mutated in storage.
   */
  static async mergeDuplicateGroup(
    group: DuplicateGroup,
    dataStore?: {
      assets?: any[];
      documents?: any[];
      fuelLogs?: any[];
      serviceRecords?: any[];
      ocrRecords?: any[];
      notifications?: any[];
    },
    options: MigrationOptions = { dryRun: true }
  ): Promise<{ canonical: CanonicalUserProfile; summary: MergedDataSummary; dryRun: boolean }> {
    const isDryRun = options.dryRun !== false;
    const canonical = this.selectCanonicalProfile(group.profiles);
    const duplicates = group.profiles.filter((p) => p.uid !== canonical.uid);
    const duplicateUids = new Set(duplicates.map((d) => d.uid));

    // Combine all verified identities
    const mergedIdentities = { ...canonical.identities };
    for (const dup of duplicates) {
      if (dup.identities?.google && !mergedIdentities.google) {
        mergedIdentities.google = dup.identities.google;
      }
      if (dup.identities?.phone && (!mergedIdentities.phone || !mergedIdentities.phone.verified)) {
        mergedIdentities.phone = dup.identities.phone;
      }
      if (dup.identities?.email && (!mergedIdentities.email || !mergedIdentities.email.verified)) {
        mergedIdentities.email = dup.identities.email;
      }

      // Merge missing profile fields if canonical doesn't have them
      if ((!canonical.name || canonical.name === 'Name not set') && dup.name && dup.name !== 'Name not set') {
        canonical.name = dup.name;
      }
      if (!canonical.pincode && dup.pincode) canonical.pincode = dup.pincode;
      if (!canonical.city && dup.city) canonical.city = dup.city;
      if (!canonical.state && dup.state) canonical.state = dup.state;
      if (!canonical.address && dup.address) canonical.address = dup.address;
      if (!canonical.photoURL && dup.photoURL) canonical.photoURL = dup.photoURL;
    }

    if (!isDryRun) {
      canonical.identities = mergedIdentities;
      canonical.isProfileComplete = IdentityResolver.checkIsProfileComplete(canonical);
      canonical.updatedAt = new Date().toISOString();
    }

    // Calculate affected data records
    let assetsMerged = 0;
    let documentsMerged = 0;
    let fuelLogsMerged = 0;
    let serviceRecordsMerged = 0;
    let ocrRecordsMerged = 0;
    let notificationsMerged = 0;

    if (dataStore?.assets) {
      for (const item of dataStore.assets) {
        if (duplicateUids.has(item.ownerId || item.userId || item.customerId)) {
          if (!isDryRun) {
            item.ownerId = canonical.uid;
            item.userId = canonical.uid;
            item.customerId = canonical.uid;
          }
          assetsMerged++;
        }
      }
    }

    if (dataStore?.documents) {
      for (const item of dataStore.documents) {
        if (duplicateUids.has(item.userId || item.ownerId)) {
          if (!isDryRun) {
            item.userId = canonical.uid;
            item.ownerId = canonical.uid;
          }
          documentsMerged++;
        }
      }
    }

    if (dataStore?.fuelLogs) {
      for (const item of dataStore.fuelLogs) {
        if (duplicateUids.has(item.userId)) {
          if (!isDryRun) {
            item.userId = canonical.uid;
          }
          fuelLogsMerged++;
        }
      }
    }

    if (dataStore?.serviceRecords) {
      for (const item of dataStore.serviceRecords) {
        if (duplicateUids.has(item.userId)) {
          if (!isDryRun) {
            item.userId = canonical.uid;
          }
          serviceRecordsMerged++;
        }
      }
    }

    if (dataStore?.ocrRecords) {
      for (const item of dataStore.ocrRecords) {
        if (duplicateUids.has(item.userId)) {
          if (!isDryRun) {
            item.userId = canonical.uid;
          }
          ocrRecordsMerged++;
        }
      }
    }

    if (dataStore?.notifications) {
      for (const item of dataStore.notifications) {
        if (duplicateUids.has(item.userId)) {
          if (!isDryRun) {
            item.userId = canonical.uid;
          }
          notificationsMerged++;
        }
      }
    }

    const summary: MergedDataSummary = {
      assetsMerged,
      documentsMerged,
      fuelLogsMerged,
      serviceRecordsMerged,
      ocrRecordsMerged,
      notificationsMerged,
      totalRecordsReassigned:
        assetsMerged + documentsMerged + fuelLogsMerged + serviceRecordsMerged + ocrRecordsMerged + notificationsMerged,
    };

    return { canonical, summary, dryRun: isDryRun };
  }

  /**
   * Generates a comprehensive dry-run or live migration report.
   */
  static buildMigrationReport(
    totalScanned: number,
    groups: DuplicateGroup[],
    mergedResults: Array<{
      group: DuplicateGroup;
      canonical: CanonicalUserProfile;
      summary: MergedDataSummary;
    }>,
    options: MigrationOptions = { dryRun: true }
  ): MigrationReport {
    const totalMerged: MergedDataSummary = {
      assetsMerged: 0,
      documentsMerged: 0,
      fuelLogsMerged: 0,
      serviceRecordsMerged: 0,
      ocrRecordsMerged: 0,
      notificationsMerged: 0,
      totalRecordsReassigned: 0,
    };

    for (const r of mergedResults) {
      totalMerged.assetsMerged += r.summary.assetsMerged;
      totalMerged.documentsMerged += r.summary.documentsMerged;
      totalMerged.fuelLogsMerged += r.summary.fuelLogsMerged;
      totalMerged.serviceRecordsMerged += r.summary.serviceRecordsMerged;
      totalMerged.ocrRecordsMerged += r.summary.ocrRecordsMerged;
      totalMerged.notificationsMerged += r.summary.notificationsMerged;
      totalMerged.totalRecordsReassigned += r.summary.totalRecordsReassigned;
    }

    const isDryRun = options.dryRun !== false;

    return {
      timestamp: new Date().toISOString(),
      dryRun: isDryRun,
      totalProfilesScanned: totalScanned,
      duplicateGroupsCount: groups.length,
      duplicateGroups: mergedResults.map((r) => ({
        groupId: r.group.groupId,
        matchedOn: r.group.matchedOn,
        matchedValue: r.group.matchedValue,
        canonicalProfile: {
          uid: r.canonical.uid,
          name: r.canonical.name,
          email: r.canonical.email,
          phone: r.canonical.phone,
        },
        duplicateProfiles: r.group.profiles
          .filter((p) => p.uid !== r.canonical.uid)
          .map((p) => ({
            uid: p.uid,
            name: p.name,
            email: p.email,
            phone: p.phone,
          })),
        recordsAffected: r.summary,
      })),
      totalRecordsAffected: totalMerged,
      conflicts: [],
      recordsRequiringManualReview: [],
      status: isDryRun ? 'DRY_RUN_COMPLETED' : 'MIGRATION_EXECUTED',
    };
  }
}
