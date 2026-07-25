import { Platform } from 'react-native';
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// WARNING: In a real app, these should be securely stored environment variables.
// Since you may not have a Supabase project yet, I am providing mock placeholders.
// You must replace these with your actual Supabase URL and Anon Key.
// Hardcoded to ensure Webpack/Metro doesn't accidentally inject invalid string values
const supabaseUrl = 'https://phgizfyyywwjieruytsy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZ2l6Znl5eXd3amllcnV5dHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzI0OTgsImV4cCI6MjEwMDQ0ODQ5OH0.2wPN8HhSyfab5FxvNEoMmG4hF0152fLX2CZnL3gvGsQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
