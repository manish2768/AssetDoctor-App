/**
 * Premium stroke icons — lucide-compatible names, react-native-svg (already in the app).
 * Consistent 1.75 stroke. No emoji.
 */

import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

const SW = 1.75;

function Base({ size = 20, color = '#64748B', children }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export function IconMenu(p) {
  return (
    <Base {...p}>
      <Line x1="4" y1="7" x2="20" y2="7" />
      <Line x1="4" y1="12" x2="20" y2="12" />
      <Line x1="4" y1="17" x2="20" y2="17" />
    </Base>
  );
}
export function IconScanLine(p) {
  return (
    <Base {...p}>
      <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <Line x1="7" y1="12" x2="17" y2="12" />
    </Base>
  );
}
export function IconBell(p) {
  return (
    <Base {...p}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10 21a2 2 0 0 0 4 0" />
    </Base>
  );
}
export function IconPlus(p) {
  return (
    <Base {...p}>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Base>
  );
}
export function IconCar(p) {
  return (
    <Base {...p}>
      <Path d="M5 17h1.5l1-3h9l1 3H19" />
      <Path d="M7 14 8.5 9h7L17 14" />
      <Circle cx="7.5" cy="17" r="1.5" />
      <Circle cx="16.5" cy="17" r="1.5" />
    </Base>
  );
}
export function IconSmartphone(p) {
  return (
    <Base {...p}>
      <Rect x="7" y="2" width="10" height="20" rx="2" />
      <Line x1="11" y1="18" x2="13" y2="18" />
    </Base>
  );
}
export function IconHouse(p) {
  return (
    <Base {...p}>
      <Path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5z" />
    </Base>
  );
}
export function IconWrench(p) {
  return (
    <Base {...p}>
      <Path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L16 8l-1.3-1.7z" />
    </Base>
  );
}
export function IconBriefcase(p) {
  return (
    <Base {...p}>
      <Rect x="3" y="7" width="18" height="13" rx="2" />
      <Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Base>
  );
}
export function IconPackage(p) {
  return (
    <Base {...p}>
      <Path d="M16.5 9.4 7.5 4.2" />
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <Path d="M3.3 7 12 12l8.7-5" />
      <Path d="M12 22V12" />
    </Base>
  );
}
export function IconFileText(p) {
  return (
    <Base {...p}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Line x1="8" y1="13" x2="16" y2="13" />
      <Line x1="8" y1="17" x2="13" y2="17" />
    </Base>
  );
}
export function IconShieldCheck(p) {
  return (
    <Base {...p}>
      <Path d="M12 3 5 6v6c0 5 3.4 8.4 7 9.5 3.6-1.1 7-4.5 7-9.5V6l-7-3z" />
      <Path d="m9 12 2 2 4-4" />
    </Base>
  );
}
export function IconShield(p) {
  return (
    <Base {...p}>
      <Path d="M12 3 5 6v6c0 5 3.4 8.4 7 9.5 3.6-1.1 7-4.5 7-9.5V6l-7-3z" />
    </Base>
  );
}
export function IconSearch(p) {
  return (
    <Base {...p}>
      <Circle cx="11" cy="11" r="7" />
      <Line x1="16.5" y1="16.5" x2="21" y2="21" />
    </Base>
  );
}
export function IconSettings(p) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Base>
  );
}
export function IconLock(p) {
  return (
    <Base {...p}>
      <Rect x="5" y="11" width="14" height="10" rx="2" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Base>
  );
}
export function IconClock(p) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </Base>
  );
}
export function IconChart(p) {
  return (
    <Base {...p}>
      <Path d="M3 3v18h18" />
      <Path d="M7 14l4-4 3 3 6-7" />
    </Base>
  );
}
export function IconZap(p) {
  return (
    <Base {...p}>
      <Polyline points="13 2 5 13 11 13 9 22 17 11 11 11 13 2" />
    </Base>
  );
}
export function IconCircleCheck(p) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="m8.5 12 2.5 2.5 4.5-5" />
    </Base>
  );
}
export function IconAlertTriangle(p) {
  return (
    <Base {...p}>
      <Path d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Base>
  );
}
export function IconChevronRight(p) {
  return (
    <Base {...p}>
      <Path d="m9 6 6 6-6 6" />
    </Base>
  );
}
export function IconX(p) {
  return (
    <Base {...p}>
      <Line x1="6" y1="6" x2="18" y2="18" />
      <Line x1="18" y1="6" x2="6" y2="18" />
    </Base>
  );
}
export function IconArrowRight(p) {
  return (
    <Base {...p}>
      <Line x1="5" y1="12" x2="19" y2="12" />
      <Path d="m13 6 6 6-6 6" />
    </Base>
  );
}
export function IconArrowLeft(p) {
  return (
    <Base {...p}>
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Path d="m11 6-6 6 6 6" />
    </Base>
  );
}
export function IconShare(p) {
  return (
    <Base {...p}>
      <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <Path d="M16 6l-4-4-4 4" />
      <Line x1="12" y1="2" x2="12" y2="15" />
    </Base>
  );
}
export function IconUser(p) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="8" r="3.5" />
      <Path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </Base>
  );
}
export function IconSpark(p) {
  return (
    <Base {...p}>
      <Path d="M12 3v4M12 17v4M4.9 6.5 7.8 9.4M16.2 14.6l2.9 2.9M3 12h4M17 12h4M4.9 17.5 7.8 14.6M16.2 9.4l2.9-2.9" />
    </Base>
  );
}

export function IconMessage(p) {
  return (
    <Base {...p}>
      <Path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0z" />
    </Base>
  );
}

const MAP = {
  menu: IconMenu,
  scan: IconScanLine,
  'scan-line': IconScanLine,
  bell: IconBell,
  plus: IconPlus,
  car: IconCar,
  vehicle: IconCar,
  smartphone: IconSmartphone,
  gadget: IconSmartphone,
  electronics: IconSmartphone,
  house: IconHouse,
  home: IconHouse,
  appliance: IconHouse,
  wrench: IconWrench,
  equipment: IconWrench,
  briefcase: IconBriefcase,
  business: IconBriefcase,
  package: IconPackage,
  other: IconPackage,
  'file-text': IconFileText,
  documents: IconFileText,
  shield: IconShield,
  'shield-check': IconShieldCheck,
  search: IconSearch,
  settings: IconSettings,
  lock: IconLock,
  clock: IconClock,
  chart: IconChart,
  zap: IconZap,
  check: IconCircleCheck,
  alert: IconAlertTriangle,
  chevron: IconChevronRight,
  x: IconX,
  arrow: IconArrowRight,
  'arrow-left': IconArrowLeft,
  share: IconShare,
  user: IconUser,
  spark: IconSpark,
  message: IconMessage,
};

export function PremiumIcon({ name = 'package', size = 20, color = '#64748B' }) {
  const Cmp = MAP[String(name).toLowerCase()] || IconPackage;
  return <Cmp size={size} color={color} />;
}

export default PremiumIcon;
