/**
 * Asset Doctor — Energy Doctor Service
 *
 * Manages electricity accounts, bill records, multi-account isolation,
 * offline-first persistence, duplicate detection, and privacy scan disposal.
 *
 * Privacy invariant:
 * The original image or PDF is NEVER permanently stored. After successful review,
 * discardScanFile is invoked to permanently delete the temporary image/PDF derivative.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ElectricityAccount,
  ElectricityBillRecord,
} from './electricityBillSchema';
import { EnergyAnalyticsEngine } from './energyAnalyticsEngine';

function getFileSystem() {
  try {
    return require('expo-file-system/legacy') || require('expo-file-system');
  } catch {
    return null;
  }
}

function getFirestore() {
  try {
    const firestore = require('@react-native-firebase/firestore').default;
    return typeof firestore === 'function' ? firestore() : null;
  } catch {
    return null;
  }
}

const STORAGE_ACCOUNTS_PREFIX = '@energy_accounts_';
const STORAGE_BILLS_PREFIX = '@energy_bills_';

const inMemoryCache = new Map<string, string>();

async function getStorageItem(key: string): Promise<string | null> {
  const mem = inMemoryCache.get(key);
  if (mem != null) return mem;
  try {
    const val = await AsyncStorage.getItem(key);
    if (val != null) {
      inMemoryCache.set(key, val);
      return val;
    }
  } catch {}
  return null;
}

async function setStorageItem(key: string, val: string): Promise<void> {
  inMemoryCache.set(key, val);
  try {
    await AsyncStorage.setItem(key, val);
  } catch {}
}

export class ElectricityBillService {
  /**
   * Discards/deletes the temporary scan image/PDF from local storage.
   * Enforces the data-first privacy principle.
   */
  public static async discardScanFile(imageUri?: string | null): Promise<boolean> {
    if (!imageUri || typeof imageUri !== 'string') return true;
    try {
      const fs = getFileSystem();
      if (fs && fs.deleteAsync) {
        await fs.deleteAsync(imageUri, { idempotent: true });
        return true;
      }
      // Node/Desktop fallback
      const nodeFs = require('fs');
      if (nodeFs && typeof nodeFs.unlinkSync === 'function') {
        const cleanPath = imageUri.replace(/^file:\/\//, '');
        if (nodeFs.existsSync(cleanPath)) {
          nodeFs.unlinkSync(cleanPath);
        }
        return true;
      }
    } catch {
      /* non-critical cleanup failure */
    }
    return false;
  }

  /**
   * Retrieves electricity accounts for a user.
   */
  public static async listAccounts(userId: string): Promise<ElectricityAccount[]> {
    if (!userId) return [];
    try {
      const raw = await getStorageItem(`${STORAGE_ACCOUNTS_PREFIX}${userId}`);
      if (raw) {
        const parsed: ElectricityAccount[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      /* proceed to cloud */
    }

    const firestore = getFirestore();
    if (firestore) {
      try {
        const snap = await firestore
          .collection('Users')
          .doc(userId)
          .collection('ElectricityAccounts')
          .orderBy('createdAt', 'asc')
          .get();
        if (!snap.empty) {
          const accounts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          await setStorageItem(`${STORAGE_ACCOUNTS_PREFIX}${userId}`, JSON.stringify(accounts)).catch(() => {});
          return accounts;
        }
      } catch {
        /* offline fallback */
      }
    }

    // Default initial account
    const defaultAcc: ElectricityAccount = {
      id: 'default_home',
      userId,
      accountName: 'Home',
      consumerId: '',
      provider: 'Electricity Provider',
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    await setStorageItem(`${STORAGE_ACCOUNTS_PREFIX}${userId}`, JSON.stringify([defaultAcc])).catch(() => {});
    return [defaultAcc];
  }

  /**
   * Saves or updates an electricity account.
   */
  public static async saveAccount(account: ElectricityAccount): Promise<ElectricityAccount> {
    const existing = await this.listAccounts(account.userId);
    const idx = existing.findIndex((a) => a.id === account.id);
    let updated: ElectricityAccount[];
    if (idx !== -1) {
      updated = existing.map((a, i) => (i === idx ? { ...a, ...account, updatedAt: new Date().toISOString() } : a));
    } else {
      updated = [...existing, { ...account, createdAt: account.createdAt || new Date().toISOString() }];
    }

    await setStorageItem(`${STORAGE_ACCOUNTS_PREFIX}${account.userId}`, JSON.stringify(updated)).catch(() => {});

    const firestore = getFirestore();
    if (firestore) {
      try {
        await firestore
          .collection('Users')
          .doc(account.userId)
          .collection('ElectricityAccounts')
          .doc(account.id)
          .set(account, { merge: true });
      } catch {
        /* offline sync queued */
      }
    }

    return account;
  }

  /**
   * Retrieves electricity bills for an account.
   */
  public static async listBills(userId: string, accountId: string): Promise<ElectricityBillRecord[]> {
    if (!userId || !accountId) return [];

    const cacheKey = `${STORAGE_BILLS_PREFIX}${userId}_${accountId}`;
    try {
      const raw = await getStorageItem(cacheKey);
      if (raw) {
        const parsed: ElectricityBillRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return EnergyAnalyticsEngine.sortBills(parsed);
        }
      }
    } catch {
      /* proceed to cloud */
    }

    const firestore = getFirestore();
    if (firestore) {
      try {
        const snap = await firestore
          .collection('Users')
          .doc(userId)
          .collection('ElectricityAccounts')
          .doc(accountId)
          .collection('bills')
          .orderBy('billingMonth', 'asc')
          .get();
        const cloudBills: ElectricityBillRecord[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        await setStorageItem(cacheKey, JSON.stringify(cloudBills)).catch(() => {});
        return EnergyAnalyticsEngine.sortBills(cloudBills);
      } catch {
        /* offline */
      }
    }

    return [];
  }

  /**
   * Checks if a newly scanned bill is a duplicate of an existing record.
   */
  public static detectDuplicateBill(
    candidate: Partial<ElectricityBillRecord>,
    existingBills: ElectricityBillRecord[]
  ): { isDuplicate: boolean; duplicateId?: string; message?: string } {
    if (!candidate || !existingBills || existingBills.length === 0) {
      return { isDuplicate: false };
    }

    const candMonth = (candidate.billingMonth || '').trim();
    const candConsumer = (candidate.consumerId || '').trim();
    const candAmount = Number(candidate.currentBillAmount);
    const candCurrReading = Number(candidate.currentMeterReading);
    const candPrevReading = Number(candidate.previousMeterReading);

    for (const b of existingBills) {
      // 1. Same consumerId and same billingMonth
      if (candConsumer && candMonth && b.consumerId === candConsumer && b.billingMonth === candMonth) {
        return {
          isDuplicate: true,
          duplicateId: b.id,
          message: `Bill for ${b.billingMonth} already exists for Consumer ID ${b.consumerId}.`,
        };
      }

      // 2. Same exact meter readings (prev + curr)
      if (
        candCurrReading > 0 &&
        candPrevReading > 0 &&
        b.currentMeterReading === candCurrReading &&
        b.previousMeterReading === candPrevReading
      ) {
        return {
          isDuplicate: true,
          duplicateId: b.id,
          message: `An electricity bill with identical readings (${candPrevReading} -> ${candCurrReading}) already exists for ${b.billingMonth}.`,
        };
      }

      // 3. Same bill date and same amount
      if (candidate.billDate && candidate.billDate === b.billDate && Math.abs(candAmount - b.currentBillAmount) < 1) {
        return {
          isDuplicate: true,
          duplicateId: b.id,
          message: `An electricity bill for ₹${b.currentBillAmount} on ${b.billDate} already exists.`,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Filter bills strictly by month (YYYY-MM).
   * Guarantees: September NEVER returns August data.
   */
  public static filterBillsByMonth(
    bills: ElectricityBillRecord[],
    targetMonth: string
  ): ElectricityBillRecord[] {
    return EnergyAnalyticsEngine.filterBillsByMonth(bills, targetMonth);
  }

  /**
   * Saves an electricity bill record (offline-first).
   */
  public static async saveBill(
    bill: ElectricityBillRecord,
    options: { discardScanUri?: string | null } = {}
  ): Promise<{ success: boolean; bill: ElectricityBillRecord; error?: string }> {
    try {
      const cacheKey = `${STORAGE_BILLS_PREFIX}${bill.userId}_${bill.accountId}`;
      const existing = await this.listBills(bill.userId, bill.accountId);
      const idx = existing.findIndex((b) => b.id === bill.id);

      let updated: ElectricityBillRecord[];
      if (idx !== -1) {
        updated = existing.map((b, i) => (i === idx ? { ...b, ...bill, updatedAt: new Date().toISOString() } : b));
      } else {
        updated = [...existing, { ...bill, createdAt: bill.createdAt || new Date().toISOString() }];
      }

      await setStorageItem(cacheKey, JSON.stringify(updated));

      // Cloud sync
      const firestore = getFirestore();
      if (firestore) {
        firestore
          .collection('Users')
          .doc(bill.userId)
          .collection('ElectricityAccounts')
          .doc(bill.accountId)
          .collection('bills')
          .doc(bill.id)
          .set(bill, { merge: true })
          .catch(() => {
            /* queued offline */
          });
      }

      // Privacy: Clean up scan file if provided
      if (options.discardScanUri) {
        await this.discardScanFile(options.discardScanUri);
      }

      return { success: true, bill };
    } catch (error: any) {
      return { success: false, bill, error: error?.message || 'Failed to save electricity bill' };
    }
  }

  /**
   * Deletes an electricity bill record.
   */
  public static async deleteBill(
    userId: string,
    accountId: string,
    billId: string
  ): Promise<boolean> {
    try {
      const cacheKey = `${STORAGE_BILLS_PREFIX}${userId}_${accountId}`;
      const existing = await this.listBills(userId, accountId);
      const updated = existing.filter((b) => b.id !== billId);
      await setStorageItem(cacheKey, JSON.stringify(updated));

      const firestore = getFirestore();
      if (firestore) {
        firestore
          .collection('Users')
          .doc(userId)
          .collection('ElectricityAccounts')
          .doc(accountId)
          .collection('bills')
          .doc(billId)
          .delete()
          .catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }
}
