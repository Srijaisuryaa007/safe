import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// WARNING: In a real app, these should be securely stored environment variables.
// Since you may not have a Supabase project yet, I am providing mock placeholders.
// You must replace these with your actual Supabase URL and Anon Key.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://phgizfyyywvjjnruybsy.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_OwT0aKIRwHHeQFT-Rs8VKA_NJ9QOPzD';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
