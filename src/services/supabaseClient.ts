import { createClient } from '@supabase/supabase-js';

// `import.meta.env` is injected by Vite in the browser, but is absent when a
// pure mapper importing this module runs under Node's test runner.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Falls back to a harmless placeholder client when unconfigured so importing
// this module never crashes the app - callers should check
// isSupabaseConfigured before relying on real data from it, same pattern as
// isMsalConfigured() in msalAuth.ts.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);
