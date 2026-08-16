/**
 * ThemeProvider — light / dark without inverting colors.
 * Preference persisted per device; defaults to light.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';

import { LIGHT, DARK } from '../theme/palettes';
import { buildNavTheme } from '../theme/branding';

const STORAGE_KEY = '@asset_doctor_theme_mode';

const ThemeContext = createContext({
  mode: 'light',
  isDark: false,
  colors: LIGHT,
  navTheme: buildNavTheme(LIGHT, false),
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('light');

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!alive) return;
        if (v === 'dark' || v === 'light') setModeState(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    setModeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const isDark = mode === 'dark';
  const colors = isDark ? DARK : LIGHT;
  const navTheme = useMemo(() => buildNavTheme(colors, isDark), [colors, isDark]);

  const value = useMemo(
    () => ({ mode, isDark, colors, navTheme, setMode, toggleMode }),
    [mode, isDark, colors, navTheme, setMode, toggleMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  return useContext(ThemeContext).colors;
}

export default ThemeProvider;
