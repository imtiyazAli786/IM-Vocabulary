/**
 * LexiCard Theme Tokens
 * Strict color, typography, and spacing constants.
 * Supports dual themes:
 * - 'classic' (Indigo Lavender - calm, professional)
 * - 'sunset' (Sunset Energy - warm orange/magenta high-contrast)
 */

import { Platform } from 'react-native';

export type ThemeId = 'classic' | 'sunset';

export const ClassicColors = {
  // Canvas & Backgrounds
  background: '#F0F2FF',       // Soft indigo-tinted canvas
  cardSurface: '#FFFFFF',
  cardBackSurface: '#F8F9FF',  // Slightly cool back face
  cardBorder: '#DDE1F5',       // Warmer indigo-tinted border
  divider: '#ECEFFE',          // Indigo-tinted divider
  inputBackground: '#F0F2FF',  // Matches canvas

  // Surface Variants
  chipSurface: '#E8EAFF',      // Inactive chip background
  surfaceElevated: '#EAECFF',  // Elevated surfaces (banners, metric boxes)

  // Typography
  textPrimary: '#0F0F23',      // Deeper near-black with slight blue
  textSecondary: '#5B6080',    // Muted blue-grey
  textMuted: '#9498B8',        // Lighter muted
  textUrdu: '#3730A3',         // Rich Indigo for Urdu Nastaliq
  textWhite: '#FFFFFF',

  // Brand Accent
  accent: '#4F46E5',           // Indigo-600
  accentLight: '#EEF2FF',      // Indigo-50
  accentDark: '#4338CA',       // Indigo-700
  accentBorder: '#C7D2FE',     // Indigo-200 border for tags & undo

  // Category Badges
  categoryBadgeBg: '#EEF2FF',
  categoryBadgeText: '#4F46E5',

  // Gestures & Feedback
  knowItGreen: '#059669',      // Richer emerald
  knowItBg: 'rgba(5, 150, 105, 0.10)',
  laterAmber: '#D97706',       // Deeper amber
  laterBg: 'rgba(217, 119, 6, 0.10)',
  starGold: '#F59E0B',
  dangerRed: '#DC2626',

  // Sync State
  syncSuccess: '#059669',
  syncPending: '#3B82F6',
  syncOffline: '#9498B8',
};

export const ClassicShadows = {
  card: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },
  cardGhost: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  chip: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
};

export const SunsetColors = {
  // Canvas & Backgrounds
  background: '#FFFBF5',       // Warm cream canvas
  cardSurface: '#FFFFFF',
  cardBackSurface: '#FFF9F5',  // Warm back face
  cardBorder: '#FED7AA',       // Warm orange-200 border
  divider: '#FEEAD2',          // Warm orange divider
  inputBackground: '#FFF7ED',  // Warm cream input

  // Surface Variants
  chipSurface: '#FFF7ED',      // Orange-50 inactive chip
  surfaceElevated: '#FFEDD5',  // Orange-100 elevated

  // Typography
  textPrimary: '#1A1A2E',      // Deep slate black
  textSecondary: '#78716C',    // Stone secondary
  textMuted: '#A8A29E',        // Stone muted
  textUrdu: '#C2410C',         // Burnt vibrant Orange (Orange-700) for Urdu
  textWhite: '#FFFFFF',

  // Brand Accent (Warm Sunset Energy)
  accent: '#EA580C',           // Orange-600
  accentLight: '#FFF7ED',      // Orange-50
  accentDark: '#C2410C',       // Orange-700
  accentBorder: '#FED7AA',     // Orange-200 border for tags & undo

  // Category Badges (Magenta/Rose punch)
  categoryBadgeBg: '#FFF1F2',  // Rose-50
  categoryBadgeText: '#DB2777', // Pink-600 / Magenta

  // Gestures & Feedback
  knowItGreen: '#059669',
  knowItBg: 'rgba(5, 150, 105, 0.10)',
  laterAmber: '#D97706',
  laterBg: 'rgba(217, 119, 6, 0.10)',
  starGold: '#F59E0B',
  dangerRed: '#DC2626',

  // Sync State
  syncSuccess: '#059669',
  syncPending: '#EA580C',
  syncOffline: '#A8A29E',
};

export const SunsetShadows = {
  card: {
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },
  cardGhost: {
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  chip: {
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
};

export const Themes = {
  classic: {
    id: 'classic' as const,
    name: 'Classic Indigo',
    description: 'Calm lavender & deep indigo',
    colors: ClassicColors,
    shadows: ClassicShadows,
  },
  sunset: {
    id: 'sunset' as const,
    name: 'Sunset Energy',
    description: 'Warm cream, bold orange & magenta',
    colors: SunsetColors,
    shadows: SunsetShadows,
  },
};

export type ThemeColors = typeof ClassicColors;
export type ThemeShadows = typeof ClassicShadows;

// Fallback exports for backward compatibility
export const Colors = ClassicColors;
export const Shadows = ClassicShadows;

export const Typography = {
  fontFamily: {
    system: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
    urdu: Platform.select({
      ios: 'Noto Nastaliq Urdu',
      android: 'serif',
      web: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif",
      default: 'serif',
    }),
  },
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    heroUrdu: 28,
    heroEnglish: 36,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
