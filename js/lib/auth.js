/* Authentication and role lookup. The role comes from public.profiles,
   which only the database trigger can write. */
import { supabase } from './supabase.js';

/** Email a one-time sign-in link that returns to this page. New emails create an account. */
export async function sendMagicLink(email) {
  const redirect = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirect, shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Calls back with { session, profile } now and on every auth change.
 * profile is null when signed out.
 */
export function onAuthChange(callback) {
  let lastUserId;
  const emit = async (session) => {
    const userId = session?.user?.id ?? null;
    if (userId === lastUserId) return;          // token refreshes don't re-render
    lastUserId = userId;
    let profile = null;
    if (userId) {
      try { profile = await getProfile(userId); } catch (e) { console.error('Profile lookup failed', e); }
    }
    callback({ session, profile });
  };
  // Defer out of the auth callback: supabase-js warns against awaiting queries inside it.
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => emit(session), 0);
  });
  return () => data.subscription.unsubscribe();
}

/** Remove auth tokens/errors left in the URL by the sign-in redirect. */
export function cleanAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;
  ['code', 'error', 'error_code', 'error_description'].forEach((k) => {
    if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; }
  });
  // Implicit flow puts access_token / error_description in the hash.
  if (/(^#|&)(access_token|refresh_token|error_description|error)=/.test(url.hash)) {
    url.hash = '';
    changed = true;
  }
  if (changed) history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/** Error text from a failed redirect (e.g. an expired link), if any. */
export function authErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return params.get('error_description') || hash.get('error_description');
}
