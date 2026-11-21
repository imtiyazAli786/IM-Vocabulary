/**
 * LexiCard Theme Context & Provider
 * Manages active theme state ('classic' | 'sunset') with AsyncStorage persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeId, ThemeColors, ThemeShadows, Themes } from './tokens';

const THEME_STORAGE_KEY = '@lexicard_theme_id';

interface ThemeContextType {
  themeId: ThemeId;
  colors: ThemeColors;
  shadows: ThemeShadows;
  isSunset: boolean;
  setThemeId: (id: ThemeId) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const defaultTheme = Themes.classic;

export const ThemeContext = createContext<ThemeContextType>({
  themeId: 'classic',
  colors: defaultTheme.colors,
  shadows: defaultTheme.shadows,
  isSunset: false,
  setThemeId: async () => {},
  toggleTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeState] = useState<ThemeId>('classic');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'classic' || saved === 'sunset') {
        setThemeState(saved);
      }
    });
  }, []);

  const setThemeId = useCallback(async (id: ThemeId) => {
    setThemeState(id);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: ThemeId = themeId === 'classic' ? 'sunset' : 'classic';
    setThemeState(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  }, [themeId]);

  const activeTheme = Themes[themeId] || Themes.classic;

  const value: ThemeContextType = {
    themeId,
    colors: activeTheme.colors,
    shadows: activeTheme.shadows,
    isSunset: themeId === 'sunset',
    setThemeId,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
