/**
 * Asset Doctor Design System — barrel export.
 * Mobile: theme tokens + RN primitives.
 * Web: cssTokens.css + utility classes.
 */

export {
  FONTS,
  TYPE,
  SPACING,
  RADIUS,
  elevation,
  ELEVATION,
  MOTION,
  HIT,
  ICON_SIZE,
} from '../theme/tokens';

export { LIGHT, DARK } from '../theme/palettes';
export { COLORS, BRAND, buildNavTheme } from '../theme/branding';

export {
  SectionHeader as LegacySectionHeader,
  FilterChip as LegacyFilterChip,
  StatusBadge as LegacyStatusBadge,
  EmptyState as LegacyEmptyState,
  SkeletonBlock,
  ErrorState,
  SyncStatusPill,
  QuickActionGrid,
  LoadingInline,
  Button,
  SurfaceCard,
  FieldLabel,
} from '../components/ui/DesignSystem';

export { PremiumIcon } from './icons';
export * from './icons';
export {
  PremiumCard,
  HeroCard,
  GlassSurface,
  SectionHeader,
  StatusBadge,
  ConfidenceBar,
  ProgressRing,
  CountUp,
  ScanBeam,
  PremiumButton,
  IconButton,
  SearchBar,
  FilterChip,
  EmptyState,
  Skeleton,
  MetricCard,
  AssetCollectionCard,
  InsightCard,
  DocumentCard,
} from './primitives';

export { ConfirmDialog } from '../components/ConfirmDialog';
export { HealthScoreExplain } from '../components/HealthScoreExplain';
export { SmartActionCard } from '../components/SmartActionCard';

export {
  BRAND_MARK_PATHS,
  brandMarkSvg,
  BRAND_WORDMARK as BRAND_MARK_WORDMARK,
  BRAND_PRODUCT_LINE,
} from './brandMark';

export {
  INTELLIGENCE_FIELDS,
  SECTION_ORDER,
  SECTION_LABELS,
  documentSuggestionsForAsset,
  vaultCopyForAsset,
  resolveIntelligenceLayout,
  categoryFamilyLabel,
} from './assetIntelligenceSchema';
