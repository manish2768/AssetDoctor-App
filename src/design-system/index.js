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
  SectionHeader,
  FilterChip,
  StatusBadge,
  EmptyState,
  SkeletonBlock,
  ErrorState,
  SyncStatusPill,
  QuickActionGrid,
  LoadingInline,
  Button,
  SurfaceCard,
  FieldLabel,
} from '../components/ui/DesignSystem';

export { ConfirmDialog } from '../components/ConfirmDialog';
export { HealthScoreExplain } from '../components/HealthScoreExplain';
export { SmartActionCard } from '../components/SmartActionCard';

export {
  INTELLIGENCE_FIELDS,
  SECTION_ORDER,
  SECTION_LABELS,
  documentSuggestionsForAsset,
  vaultCopyForAsset,
  resolveIntelligenceLayout,
  categoryFamilyLabel,
} from './assetIntelligenceSchema';
