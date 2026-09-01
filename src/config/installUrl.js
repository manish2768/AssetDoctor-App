/**
 * Asset Doctor — central install / web-preview URL configuration used by the
 * Refill Impact Card + Monthly Ride Passport (QR codes, share cards).
 *
 * This is the single place to change where the QR / share cards point. It is
 * NOT hard-coded into any card component — always import from here.
 *
 * Change this value once your official listing / web-preview is live.
 */

import { PLAY_STORE_URL_FALLBACK } from '../constants/appIdentity';

/**
 * The URL embedded into QR codes on every shared card.
 *
 * Defaults to the official Google Play install URL (already centralised in
 * appIdentity). Override at build-time via EXPO_PUBLIC_ASSET_DOCTOR_INSTALL_URL
 * if you want a web-preview or a different destination.
 */
export const ASSET_DOCTOR_INSTALL_URL =
  String(process.env.EXPO_PUBLIC_ASSET_DOCTOR_INSTALL_URL || '').trim() ||
  PLAY_STORE_URL_FALLBACK;

/** App Store badge text + the underlying store name (for the footer). */
export const STORE_BADGES = {
  appStore: { label: 'App Store' },
  googlePlay: { label: 'Google Play' },
};

export default ASSET_DOCTOR_INSTALL_URL;
