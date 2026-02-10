
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwlrmynlpbhusvzvlsmp.supabase.co';
// NOTE: The provided key seems to be in a non-standard format. 
// Standard keys usually start with 'ey...'. 
// If you encounter auth errors, please verify the Anon Public Key from Supabase Dashboard > Project Settings > API.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bHJteW5scGJodXN2enZsc21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAzMTgsImV4cCI6MjA4NTc1NjMxOH0.izHAtEXIpKi7LasNvZJ69NLlBWUQ1lvae6XWF8rJDS4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
