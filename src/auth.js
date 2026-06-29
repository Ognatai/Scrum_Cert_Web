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
    callback(null);
    return;
  }
  supabase.auth.getSession().then(({ data }) => callback(data.session));
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function getCurrentUser() {
  if (!isConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
