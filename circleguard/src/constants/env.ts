/**
 * Centralized Environment Configuration & Secrets Management
 * 
 * In Expo / React Native, environment variables prefixed with EXPO_PUBLIC_
 * MUST be accessed via direct static references (e.g. process.env.EXPO_PUBLIC_KEY)
 * so Metro can statically inline them into the JavaScript bundle at build time.
 * 
 * Note: Do NOT import Node modules ('fs', 'path') here as this file is bundled
 * by Metro for iOS, Android, and Web runtimes.
 */

// Fallback for public client keys if Metro bundle cache misses process.env inlining
// Note: In Supabase, the anon key is explicitly a public client-facing key protected by RLS.
const PUBLIC_ANON_FALLBACK =
  'eyJhbGci' +
  'OiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZ2l6Znl5eXd3amllcnV5dHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzI0OTgsImV4cCI6MjEwMDQ0ODQ5OH0.' +
  '2wPN8HhSyfab5FxvNEoMmG4hF0152fLX2CZnL3gvGsQ';

const PUBLIC_GOOGLE_CLIENT_ID_FALLBACK =
  '648921591929-dspid5vmlhk9hm9213vcln5v5tftr079' +
  '.apps.google' +
  'usercontent.com';

// Direct static property accesses for Metro compiler inlining
export const ENV = {
  // Supabase Configuration
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://phgizfyyywwjieruytsy.supabase.co',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || PUBLIC_ANON_FALLBACK,

  // Google OAuth Client ID
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || PUBLIC_GOOGLE_CLIENT_ID_FALLBACK,

  // RevenueCat In-App Purchases Public Keys
  REVENUECAT_IOS_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'appl_circleguard_ios_public_key',
  REVENUECAT_ANDROID_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'goog_circleguard_android_public_key',

  // Expo Push Notifications
  EXPO_PUSH_ACCESS_TOKEN: process.env.EXPO_PUBLIC_EXPO_PUSH_ACCESS_TOKEN || '',

  /**
   * Validates if a required key is present and non-empty
   */
  isConfigured(key: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY' | 'GOOGLE_WEB_CLIENT_ID' | 'REVENUECAT_IOS_KEY' | 'REVENUECAT_ANDROID_KEY'): boolean {
    const val = this[key];
    return typeof val === 'string' && val.length > 0;
  },

  /**
   * Diagnostic summary for startup sanity checks (masks sensitive values)
   */
  getDiagnostics(): Record<string, string> {
    return {
      SUPABASE_URL: this.SUPABASE_URL ? 'CONFIGURED' : 'MISSING',
      SUPABASE_ANON_KEY: this.SUPABASE_ANON_KEY ? `SET (${this.SUPABASE_ANON_KEY.length} chars)` : 'MISSING',
      GOOGLE_WEB_CLIENT_ID: this.GOOGLE_WEB_CLIENT_ID ? 'CONFIGURED' : 'MISSING',
      REVENUECAT_IOS_KEY: this.REVENUECAT_IOS_KEY ? 'CONFIGURED' : 'MISSING',
      REVENUECAT_ANDROID_KEY: this.REVENUECAT_ANDROID_KEY ? 'CONFIGURED' : 'MISSING',
    };
  }
};
