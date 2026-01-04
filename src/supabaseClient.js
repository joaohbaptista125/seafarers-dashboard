import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nqighosnslwggzpledrd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaWdob3Nuc2x3Z2d6cGxlZHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjMwNjUsImV4cCI6MjA4MzAzOTA2NX0.7Ve-BN5oTfeuSlubIjR3oXC4_AsMXjKMIwqwSL13upg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
