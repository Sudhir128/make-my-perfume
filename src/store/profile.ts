/*
 * The visitor's profile, kept in this browser only. There are no accounts:
 * when a backend exists, this store becomes a call to it.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/storage';

export interface ProfileDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export const EMPTY_PROFILE: ProfileDetails = { name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '' };

interface ProfileState {
  details: ProfileDetails;
  save: (details: ProfileDetails) => void;
  clear: () => void;
}

export const PROFILE_STORAGE_KEY = 'mmp.profile.v1';

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      details: EMPTY_PROFILE,
      save: (details) => set({ details }),
      clear: () => set({ details: EMPTY_PROFILE }),
    }),
    { name: PROFILE_STORAGE_KEY, version: 1, storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ details: s.details }) },
  ),
);

/** Field-level validation: Indian 10-digit mobile and 6-digit PIN code. */
export function validateProfile(d: ProfileDetails): Partial<Record<keyof ProfileDetails, string>> {
  const e: Partial<Record<keyof ProfileDetails, string>> = {};
  if (d.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = 'Enter a valid email address.';
  if (d.phone.trim() && !/^(\+91[\s-]?)?[6-9]\d{9}$/.test(d.phone.replace(/\s/g, ''))) e.phone = 'Enter a 10-digit mobile number.';
  if (d.pincode.trim() && !/^[1-9]\d{5}$/.test(d.pincode.trim())) e.pincode = 'Enter a 6-digit PIN code.';
  return e;
}
