import { supabase, isConfigured } from './supabase.js';

export async function signUp(email, password) {
  if (!isConfigured) return { error: { message: 'Supabase nicht konfiguriert.' } };
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  if (!isConfigured) return { error: { message: 'Supabase nicht konfiguriert.' } };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!isConfigured) return;
  return supabase.auth.signOut();
}

export function onAuth(callback) {
  if (!isConfigured) {
    callback(null, 'INITIAL_SESSION');
    return;
  }
  supabase.auth.getSession().then(({ data }) => callback(data.session, 'INITIAL_SESSION'));
  supabase.auth.onAuthStateChange((event, session) => callback(session, event));
}

export async function getCurrentUser() {
  if (!isConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
