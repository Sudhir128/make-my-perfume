/*
 * Storefront customer authentication backed by Supabase Auth, isolated from /admin.
 */
import { create } from 'zustand';
import { getCustomerSupabase } from '../lib/supabase';

export interface CustomerAccount {
  id: string;
  email: string;
  fullName: string;
}

interface CustomerAuthState {
  user: CustomerAccount | null;
  initialized: boolean;
  loading: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<CustomerAccount>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ user: CustomerAccount | null; needsVerification: boolean }>;
  signOut: () => Promise<void>;
}

let listenerBound = false;

function toAccount(raw: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): CustomerAccount | null {
  if (!raw?.id || !raw.email) return null;
  const metaName = typeof raw.user_metadata?.full_name === 'string' ? raw.user_metadata.full_name : '';
  return {
    id: raw.id,
    email: raw.email,
    fullName: metaName,
  };
}

export const useCustomerAuth = create<CustomerAuthState>()((set, get) => ({
  user: null,
  initialized: false,
  loading: false,

  init: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const sb = await getCustomerSupabase();
      if (!listenerBound) {
        listenerBound = true;
        sb.auth.onAuthStateChange((_event, session) => {
          set({ user: toAccount(session?.user), initialized: true, loading: false });
        });
      }
      const { data } = await sb.auth.getSession();
      set({ user: toAccount(data.session?.user), initialized: true, loading: false });
    } catch {
      set({ user: null, initialized: true, loading: false });
    }
  },

  signIn: async (email, password) => {
    const sb = await getCustomerSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const acc = toAccount(data.user);
    if (!acc) throw new Error('Could not load signed-in account.');
    set({ user: acc, initialized: true });
    return acc;
  },

  signUp: async (fullName, email, password) => {
    const sb = await getCustomerSupabase();
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });
    if (error) throw new Error(error.message);
    const acc = toAccount(data.user);
    if (data.session && acc) {
      set({ user: acc, initialized: true });
      return { user: acc, needsVerification: false };
    }
    return { user: acc, needsVerification: true };
  },

  signOut: async () => {
    try {
      const sb = await getCustomerSupabase();
      await sb.auth.signOut();
    } finally {
      set({ user: null });
    }
  },
}));

