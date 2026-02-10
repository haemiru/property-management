
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fwlrmynlpbhusvzvlsmp.supabase.co';
// NOTE: The provided key seems to be in a non-standard format. 
// Standard keys usually start with 'ey...'. 
// If you encounter auth errors, please verify the Anon Public Key from Supabase Dashboard > Project Settings > API.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bHJteW5scGJodXN2enZsc21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAzMTgsImV4cCI6MjA4NTc1NjMxOH0.izHAtEXIpKi7LasNvZJ69NLlBWUQ1lvae6XWF8rJDS4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
