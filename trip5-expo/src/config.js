import Constants from 'expo-constants';

export const Config = {
  apiBaseURL:
    Constants.expoConfig?.extra?.apiBaseURL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'https://trip5-api.vercel.app',
  ownerEmail1: 'technologiesbrightminds@gmail.com',
  ownerEmail2: '',
  googleMapsApiKey:
    Constants.expoConfig?.extra?.googleMapsApiKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '',
  /** Domain for synthetic auth emails `{digits}@domain` (Supabase email/password). */
  authEmailDomain:
    Constants.expoConfig?.extra?.authEmailDomain ||
    process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN ||
    'phone.trip5.app',
};
