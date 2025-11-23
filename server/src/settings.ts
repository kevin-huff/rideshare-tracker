import { getDb } from './db.js';

export interface SettingsRow {
  overlay_privacy_radius_m: number;
  overlay_hide_location: number;
  overlay_theme: string;
}

export interface OverlayTheme {
  name: string;
  glass: string;
  text: string;
  muted: string;
  success: string;
  danger: string;
  accent: string;
  background: string;
}

const OVERLAY_THEMES: Record<string, OverlayTheme> = {
  midnight: {
    name: 'midnight',
    glass: 'rgba(10,12,22,0.65)',
    text: '#eef2ff',
    muted: '#94a3b8',
    success: '#6ef2c4',
    danger: '#ff7b7b',
    accent: '#7dd3fc',
    background: '#030712'
  },
  ember: {
    name: 'ember',
    glass: 'rgba(31,20,15,0.7)',
    text: '#fff7ed',
    muted: '#fed7aa',
    success: '#f97316',
    danger: '#fb7185',
    accent: '#fdba74',
    background: '#1b0f08'
  },
  glacier: {
    name: 'glacier',
    glass: 'rgba(9,18,31,0.7)',
    text: '#e0f2fe',
    muted: '#bae6fd',
    success: '#67e8f9',
    danger: '#fca5a5',
    accent: '#7dd3fc',
    background: '#0b1220'
  }
};

export function getSettings(): SettingsRow {
  const db = getDb();
  const row = db
    .prepare('SELECT overlay_privacy_radius_m, overlay_hide_location, overlay_theme FROM settings WHERE id = 1')
    .get() as SettingsRow | undefined;

  if (!row) {
    // In case schema seed failed, insert defaults
    db.prepare(
      `INSERT OR REPLACE INTO settings (id, overlay_privacy_radius_m, overlay_hide_location, overlay_theme)
       VALUES (1, 0, 0, 'midnight')`
    ).run();
    return {
      overlay_privacy_radius_m: 0,
      overlay_hide_location: 0,
      overlay_theme: 'midnight'
    };
  }

  return row;
}

export function updateSettings(partial: Partial<SettingsRow>): SettingsRow {
  const db = getDb();
  const current = getSettings();
  const next: SettingsRow = {
    overlay_privacy_radius_m: partial.overlay_privacy_radius_m ?? current.overlay_privacy_radius_m,
    overlay_hide_location: partial.overlay_hide_location ?? current.overlay_hide_location,
    overlay_theme: partial.overlay_theme ?? current.overlay_theme
  };

  db.prepare(
    `UPDATE settings
     SET overlay_privacy_radius_m = ?,
         overlay_hide_location = ?,
         overlay_theme = ?
     WHERE id = 1`
  ).run(next.overlay_privacy_radius_m, next.overlay_hide_location, next.overlay_theme);

  return next;
}

export function getOverlayTheme(name: string): OverlayTheme {
  return OVERLAY_THEMES[name] ?? OVERLAY_THEMES.midnight;
}

export const overlayThemes = OVERLAY_THEMES;
