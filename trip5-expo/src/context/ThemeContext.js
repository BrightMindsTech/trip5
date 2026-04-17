import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { darkColors, lightColors } from '../theme';

const STORAGE_KEY = '@trip5/theme_preference';

/** @typedef {'auto' | 'light' | 'dark'} ThemePreference */

const ThemeContext = createContext({
  /** @type {ThemePreference} */
  preference: 'auto',
  /** @type {(p: ThemePreference) => void} */
  setPreference: () => {},
  isDark: false,
  /** Resolved palette (light or dark). */
  colors: lightColors,
  /** True when preference is auto and Jordan local time is night (18:00–06:00). */
  isJordanNight: false,
});

/**
 * Hour (0–23) in Asia/Amman at `date`.
 * @param {Date} [date]
 */
export function getJordanHour(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Amman',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour');
  if (!hourPart) return 12;
  return parseInt(hourPart.value, 10);
}

/** Night: 18:00 inclusive … 06:00 exclusive (same calendar day semantics in Amman). */
export function isJordanNightTime(date = new Date()) {
  const h = getJordanHour(date);
  return h >= 18 || h < 6;
}

function resolveDark(preference, jordanNight) {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return jordanNight;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(/** @type {ThemePreference} */ ('auto'));
  const [jordanNight, setJordanNight] = useState(() => isJordanNightTime());

  const refreshJordanNight = useCallback(() => {
    setJordanNight(isJordanNightTime());
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw === 'light' || raw === 'dark' || raw === 'auto') {
          setPreferenceState(raw);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshJordanNight();
    const id = setInterval(refreshJordanNight, 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshJordanNight();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [refreshJordanNight]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = useMemo(
    () => resolveDark(preference, jordanNight),
    [preference, jordanNight]
  );

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      isDark,
      colors,
      isJordanNight: jordanNight,
    }),
    [preference, setPreference, isDark, colors, jordanNight]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
