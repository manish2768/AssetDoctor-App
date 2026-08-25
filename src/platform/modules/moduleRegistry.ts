/**
 * Asset Doctor — Central Asset Module Registry
 * Allows any new asset category (Solar, Medical, Farm, Aviation) to be plugged in seamlessly.
 */

import { AssetCategoryType, UniversalAssetModel } from '../core/universalAssetSchema';
import { AssetModuleDefinition, ModuleCapabilities } from './types';
import { vehicleModule } from './vehicleModule';
import { electronicsModule } from './electronicsModule';
import { appliancesModule } from './appliancesModule';
import { homeModule } from './homeModule';
import { businessModule } from './businessModule';
import { industrialModule } from './industrialModule';
import { customModule } from './customModule';

class AssetModuleRegistry {
  private modules: Map<AssetCategoryType, AssetModuleDefinition> = new Map();

  constructor() {
    this.registerModule(vehicleModule);
    this.registerModule(electronicsModule);
    this.registerModule(appliancesModule);
    this.registerModule(homeModule);
    this.registerModule(businessModule);
    this.registerModule(industrialModule);
    this.registerModule(customModule);
  }

  public registerModule(module: AssetModuleDefinition): void {
    this.modules.set(module.category, module);
  }

  public getModule(category: AssetCategoryType | string): AssetModuleDefinition {
    const normalized = (category || '').toUpperCase() as AssetCategoryType;
    return this.modules.get(normalized) || customModule;
  }

  public getCapabilities(assetOrCategory: UniversalAssetModel | AssetCategoryType | string): ModuleCapabilities {
    if (typeof assetOrCategory === 'object' && assetOrCategory !== null) {
      return this.getModule(assetOrCategory.category).capabilities;
    }
    return this.getModule(assetOrCategory).capabilities;
  }

  public listModules(): AssetModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  public getSupportedCategories(): AssetCategoryType[] {
    return Array.from(this.modules.keys());
  }
}

export const assetModuleRegistry = new AssetModuleRegistry();
