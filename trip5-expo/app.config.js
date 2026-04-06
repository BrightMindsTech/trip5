require("dotenv").config();

const googleMapsKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  "";
const apiBaseURL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://trip5-api.vercel.app";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const authEmailDomain = process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN || "phone.trip5.app";

export default {
  expo: {
    name: "Trip5",
    extra: {
      googleMapsApiKey: googleMapsKey,
      apiBaseURL,
      supabaseUrl,
      supabaseAnonKey,
      authEmailDomain,
    },
    slug: "trip5-expo",
    scheme: "trip5",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/trip5-logo.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/trip5-logo.png",
      resizeMode: "contain",
      backgroundColor: "#1A0A2E",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.trip5.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Trip5 needs your location to set your pickup point on the map.",
      },
      config: {
        googleMapsApiKey: googleMapsKey,
      },
    },
    android: {
      package: "com.trip5.app",
      adaptiveIcon: {
        backgroundColor: "#1A0A2E",
        foregroundImage: "./assets/trip5-logo.png",
      },
      config: {
        googleMaps: {
          apiKey: googleMapsKey,
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["@react-native-community/datetimepicker"],
  },
};
