import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://peeqprzrbbycswotbnwt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZXFwcnpyYmJ5Y3N3b3Ribnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MjgxNzAsImV4cCI6MjA4MzEwNDE3MH0.d4LuFJP6i9mH9Fsg8Pu3B_sFdg1-GI3pWA1F_GzpUXg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
