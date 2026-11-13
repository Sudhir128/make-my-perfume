import { describe, expect, it } from 'vitest';
import {
  BOTTLE_LABEL_MAX,
  createInitialDraft,
  PROVISIONAL_SIZES,
  validateBottleLabel,
  validateInternationalPhone,
  validateOptionalEmail,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4Contact,
} from './customPerfume';

describe('customPerfume validation', () => {
  it('validates step 1 families and character requirements', () => {
    const d = createInitialDraft();
    expect(validateStep1(d)).toEqual({
      families: 'Select at least one fragrance family to continue.',
      character: 'Choose a fragrance character to continue.',
    });
    d.families = ['Warm', 'Woody'];
    d.character = 'Balanced & Versatile';
    expect(validateStep1(d)).toEqual({});
  });

  it('validates step 2 intensity while keeping notes and occasion optional', () => {
    const d = createInitialDraft();
    expect(validateStep2(d)).toEqual({ intensity: 'Select your preferred fragrance intensity.' });
    d.intensity = 'Moderate';
    expect(validateStep2(d)).toEqual({});
  });

  it('validates bottle sizes and personalized label character limits & allowed symbols', () => {
    expect(validateBottleLabel('')).toBeNull();
    expect(validateBottleLabel('Meera No. 5 & Rose')).toBeNull();
    expect(validateBottleLabel('A'.repeat(BOTTLE_LABEL_MAX + 1))).toContain('30 characters');
    expect(validateBottleLabel('Test <script>')).toContain('Use letters, numbers, spaces');

    const d = createInitialDraft('Signature Amber');
    d.bottleSizeMl = 100;
    expect(validateStep3(d, PROVISIONAL_SIZES)).toEqual({});
  });

  it('supports international mobile / WhatsApp numbers, optional email, and required consent', () => {
    expect(validateInternationalPhone('+971 50 123 4567')).toBeNull();
    expect(validateInternationalPhone('98400 12345')).toBeNull();
    expect(validateInternationalPhone('123')).toContain('7 to 15 digits');
    expect(validateOptionalEmail('')).toBeNull();
    expect(validateOptionalEmail('', true)).toContain('email');
    expect(validateOptionalEmail('bad')).toContain('valid');
    expect(validateOptionalEmail('meera@example.com')).toBeNull();

    const d = createInitialDraft();
    d.fullName = 'Meera Krishnan';
    d.mobileNumber = '+44 7911 123456';
    const errs = validateStep4Contact(d, false);
    expect(errs.mobileNumber).toBeUndefined();
    expect(errs.email).toBeUndefined();
    expect(errs.consentAccepted).toBeDefined();
    d.consentAccepted = true;
    expect(validateStep4Contact(d, false)).toEqual({});
  });
});
