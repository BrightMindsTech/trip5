/**
 * Trip5 app theme - colors pulled from the T5 logo.
 * Logo palette: neon violet glow, metallic silver, dark purple base.
 */
export const lightColors = {
  // From logo: vibrant neon purple glow
  primary: '#A855F7',
  primaryLight: '#F3E8FF',
  primaryDark: '#7C3AED',
  // From logo: metallic silver/white highlights
  white: '#FFFFFF',
  metallic: '#E2E8F0',
  // From logo: dark purple container (for accents, splash)
  logoDark: '#1A0A2E',
  // App surfaces - light lavender to complement logo
  background: '#FAF5FF',
  surface: '#FFFFFF',
  // From logo: deep purple for text
  text: '#1E1B4B',
  textSecondary: '#7C3AED',
  textMuted: '#64748B',
  border: '#E9D5FF',
  disabled: '#DDD6FE',
  checkBg: '#A855F7',
  placeholder: '#94A3B8',
  error: '#DC2626',
  errorBg: '#FEE2E2',
};

/** Dark palette: same keys as light, tuned for night UI. */
export const darkColors = {
  primary: '#C084FC',
  primaryLight: '#3B2666',
  primaryDark: '#A855F7',
  white: '#F8FAFC',
  metallic: '#334155',
  logoDark: '#0B0614',
  background: '#0F0A1A',
  surface: '#1A1333',
  text: '#F3E8FF',
  textSecondary: '#C4B5FD',
  textMuted: '#94A3B8',
  border: '#3D2A5C',
  disabled: '#4C3A6E',
  checkBg: '#A855F7',
  placeholder: '#64748B',
  error: '#F87171',
  errorBg: '#450A0A',
};

/** Fallback when ThemeProvider is not mounted (e.g. tests). */
export const colors = lightColors;

// iOS design system
export const ios = {
  radius: { sm: 8, md: 10, lg: 12, xl: 14, xxl: 20 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  fontSize: { caption: 12, footnote: 13, subhead: 15, body: 17, callout: 16, title3: 20, title2: 22, title1: 28 },
  lineHeight: { caption: 16, footnote: 18, body: 22 },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  minTouchTarget: 44,
};

/**
 * Google Maps styling (Android + Google provider on iOS).
 * Applied when app dark mode is active.
 */
export const googleMapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
];
