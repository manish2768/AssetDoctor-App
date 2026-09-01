#!/usr/bin/env node
/**
 * Rasterize Asset Doctor launcher / splash / notification icons from the
 * approved master artwork. Uses macOS `sips` — no extra npm packages.
 *
 * Source of truth (do not invent a second mark):
 *   assets/branding/asset-doctor-app-icon-master.png
 *   assets/branding/asset-doctor-adaptive-foreground-master.png
 *   assets/branding/asset-doctor-splash-master.png
 *   assets/branding/asset-doctor-mark.svg
 *   assets/branding/notification-mark.svg
 *
 * Usage: node scripts/generate-app-icons.js
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const ANDROID_RES = path.join(ROOT, 'android/app/src/main/res');

const MASTER_ICON_SRC = path.join(ASSETS, 'branding/asset-doctor-app-icon-master.png');
const MASTER_ADAPTIVE_SRC = path.join(ASSETS, 'branding/asset-doctor-adaptive-foreground-master.png');
const MASTER_SPLASH_SRC = path.join(ASSETS, 'branding/asset-doctor-splash-master.png');
const MASTER_MARK_SVG = path.join(ASSETS, 'branding/asset-doctor-mark.svg');
const MASTER_NOTIFY_SVG = path.join(ASSETS, 'branding/notification-mark.svg');

const MASTER_ICON = path.join(ASSETS, 'icon.png');
const MASTER_ADAPTIVE = path.join(ASSETS, 'adaptive-icon.png');
const MASTER_SPLASH = path.join(ASSETS, 'splash-icon.png');

function sipsResize(src, dest, size) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync('sips', ['-z', String(size), String(size), src, '--out', dest], {
    stdio: 'pipe',
  });
}

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const SPLASH = { mdpi: 192, hdpi: 288, xhdpi: 384, xxhdpi: 576, xxxhdpi: 768 };
const NOTIFY = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };

function rasterizeNotification(dest, size) {
  const swift = `
import AppKit
import Foundation
let src = URL(fileURLWithPath: "${MASTER_NOTIFY_SVG}")
let dst = URL(fileURLWithPath: "${dest}")
let dim = CGFloat(${size})
guard let img = NSImage(contentsOf: src) else { exit(2) }
let out = NSImage(size: NSSize(width: dim, height: dim))
out.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high
img.draw(in: NSRect(x: 0, y: 0, width: dim, height: dim),
         from: .zero, operation: .sourceOver, fraction: 1)
out.unlockFocus()
guard let tiff = out.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff) else { exit(3) }
rep.size = NSSize(width: dim, height: dim)
guard let png = rep.representation(using: .png, properties: [:]) else { exit(4) }
try png.write(to: dst)
`;
  const tmp = path.join('/tmp', `ad-notify-${size}.swift`);
  fs.writeFileSync(tmp, swift);
  execFileSync('swift', [tmp], { stdio: 'pipe' });
}

function main() {
  for (const src of [MASTER_ICON_SRC, MASTER_ADAPTIVE_SRC, MASTER_SPLASH_SRC, MASTER_MARK_SVG]) {
    if (!fs.existsSync(src)) {
      throw new Error(`Missing approved master artwork: ${src}`);
    }
  }

  copy(MASTER_ICON_SRC, MASTER_ICON);
  copy(MASTER_ADAPTIVE_SRC, MASTER_ADAPTIVE);
  copy(MASTER_SPLASH_SRC, MASTER_SPLASH);
  copy(MASTER_MARK_SVG, path.join(ASSETS, 'app-icon-source.svg'));
  copy(path.join(ASSETS, 'branding/asset-doctor-mark-transparent.svg'), path.join(ASSETS, 'adaptive-icon-source.svg'));
  copy(MASTER_MARK_SVG, path.join(ROOT, 'public/icon.svg'));

  sipsResize(MASTER_ICON, path.join(ASSETS, 'logo-brand.png'), 512);
  sipsResize(MASTER_ICON, path.join(ROOT, 'public/icon.png'), 512);
  sipsResize(MASTER_ICON, path.join(ROOT, 'public/logo.png'), 512);

  for (const [density, size] of Object.entries(LAUNCHER)) {
    const dir = path.join(ANDROID_RES, `mipmap-${density}`);
    sipsResize(MASTER_ICON, path.join(dir, 'ic_launcher.png'), size);
    sipsResize(MASTER_ICON, path.join(dir, 'ic_launcher_round.png'), size);
  }
  for (const [density, size] of Object.entries(FOREGROUND)) {
    sipsResize(MASTER_ADAPTIVE, path.join(ANDROID_RES, `mipmap-${density}`, 'ic_launcher_foreground.png'), size);
  }
  for (const [density, size] of Object.entries(SPLASH)) {
    sipsResize(MASTER_SPLASH, path.join(ANDROID_RES, `drawable-${density}`, 'splashscreen_logo.png'), size);
  }

  const notifyMaster = path.join(ASSETS, 'notification-icon.png');
  try {
    rasterizeNotification(notifyMaster, 96);
    for (const [density, size] of Object.entries(NOTIFY)) {
      sipsResize(notifyMaster, path.join(ANDROID_RES, `drawable-${density}`, 'notification_icon.png'), size);
    }
  } catch (err) {
    console.warn('Notification silhouette rasterize skipped:', err.message);
  }

  console.log('Asset Doctor icons generated from approved masters.');
}

main();
