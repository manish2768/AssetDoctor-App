import { saveAssetToCloud } from './assetCloudService';

export interface SampleAsset {
  name: string;
  category: string;
  brand?: string;
  purchaseDate: string;
  expiryDate?: string;
  price?: number;
  notes?: string;
  imageUrl?: string;
  [key: string]: any;
}

export const SAMPLE_ASSETS: SampleAsset[] = [
  {
    name: "TVS Ronin 225 (Special Edition)",
    category: "Bike",
    brand: "TVS Motors",
    purchaseDate: "2024-03-15",
    expiryDate: "2026-08-15", // Upcoming renewal warning
    price: 172000,
    notes: "RSA Active. Insurance due in August 2026.",
    imageUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500"
  },
  {
    name: "LG 1.5 Ton 5 Star Split AC",
    category: "Home Appliance",
    brand: "LG Electronics",
    purchaseDate: "2023-05-10",
    expiryDate: "2028-05-10", // 5 Year PCB Warranty
    price: 42500,
    notes: "Free service #3 pending.",
    imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500"
  },
  {
    name: "Apple MacBook Pro M3",
    category: "Gadget",
    brand: "Apple",
    purchaseDate: "2025-01-10",
    expiryDate: "2026-01-10",
    price: 169900,
    notes: "AppleCare+ Active.",
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500"
  }
];

// डमी एसेट्स को क्लाउड / स्टेट में लोड करने का फंक्शन
export const loadDemoAssets = async (userId: string) => {
  try {
    const promises = SAMPLE_ASSETS.map(asset => 
      saveAssetToCloud({
        userId,
        name: asset.name,
        category: asset.category,
        brand: asset.brand,
        purchaseDate: asset.purchaseDate,
        expiryDate: asset.expiryDate,
        price: asset.price,
        notes: asset.notes,
        imageUrl: asset.imageUrl,
      })
    );
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error("Failed to load demo assets:", error);
    return false;
  }
};

