/* Single shared Supabase client, loaded from the CDN as an ES module. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Implicit flow: the emailed link signs you in from any browser, not only
    // the one that requested it. Tokens arrive in the URL hash and are removed
    // right after sign-in (see cleanAuthParamsFromUrl).
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
