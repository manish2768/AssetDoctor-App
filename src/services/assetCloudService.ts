import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';

export interface Asset {
  id?: string;
  userId: string;
  name: string;
  category: string;
  purchaseDate: string;
  expiryDate?: string;
  pucExpiry?: string;
  insuranceExpiry?: string;
  price?: number;
  imageUrl?: string;
  notes?: string;
  [key: string]: any;
}

// 1. क्लाउड में एसेट सेव करें (Save asset to Cloud)
export const saveAssetToCloud = async (asset: Asset) => {
  try {
    const docRef = await addDoc(collection(db, "assets"), {
      ...asset,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving asset to Cloud:", error);
    throw error;
  }
};

// 2. लॉगिन किए हुए यूज़र के सारे एसेट्स लोड करें (Fetch assets for logged in user)
export const fetchUserAssetsFromCloud = async (userId: string): Promise<Asset[]> => {
  try {
    const q = query(collection(db, "assets"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const assets: Asset[] = [];
    querySnapshot.forEach((docSnap) => {
      assets.push({ id: docSnap.id, ...docSnap.data() } as Asset);
    });
    return assets;
  } catch (error) {
    console.error("Error fetching assets from Cloud:", error);
    return [];
  }
};

// 3. क्लाउड में एसेट अपडेट करें (Update asset in Cloud)
export const updateAssetInCloud = async (assetId: string, updatedFields: Partial<Asset>) => {
  try {
    const assetRef = doc(db, "assets", assetId);
    await updateDoc(assetRef, {
      ...updatedFields,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error updating asset in Cloud:", error);
    throw error;
  }
};

// 4. क्लाउड से एसेट डिलीट करें (Delete asset from Cloud)
export const deleteAssetFromCloud = async (assetId: string) => {
  try {
    const assetRef = doc(db, "assets", assetId);
    await deleteDoc(assetRef);
  } catch (error) {
    console.error("Error deleting asset from Cloud:", error);
    throw error;
  }
};

export { SAMPLE_ASSETS, loadDemoAssets } from './sampleAssets';
