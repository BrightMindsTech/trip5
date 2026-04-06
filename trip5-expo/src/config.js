import Constants from 'expo-constants';

const supabaseUrlRaw =
  Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = String(supabaseUrlRaw).replace(/\/$/, '');

export const Config = {
  apiBaseURL:
    Constants.expoConfig?.extra?.apiBaseURL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'https://trip5-api.vercel.app',
  /** Same project as the Supabase JS client — used for Edge Functions base URL. */
  supabaseUrl,
  supabaseAnonKey:
    Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  /**
   * When set (Supabase project URL in env), order + driver APIs use Edge Functions instead of `apiBaseURL`.
   * Deploy: `supabase functions deploy orders` and `supabase functions deploy driver-orders`
   */
  edgeFunctionsBaseURL: supabaseUrl ? `${supabaseUrl}/functions/v1` : '',
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
  /** Shown on driver sign-up; call / WhatsApp to request a driver account. */
  driverRegistrationPhone:
    Constants.expoConfig?.extra?.driverRegistrationPhone ||
    process.env.EXPO_PUBLIC_DRIVER_CONTACT_PHONE ||
    '+962772182987',
};
