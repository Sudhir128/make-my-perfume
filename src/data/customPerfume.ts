/*
 * Data config, client-side validation, and Supabase submission helpers
 * for the /make "Create Your Perfume" experience.
 */
import { getCustomerSupabase, getSupabase } from '../lib/supabase';
import type { PlacedOrderReceipt } from '../store/orders';
import { dispatchInvoiceEmail, type PaymentMethod } from './orders';

export const CUSTOM_FAMILIES = [
  { name: 'Fresh', subtitle: 'Crisp citrus, clean air, green leaves' },
  { name: 'Warm', subtitle: 'Spiced resin, ambered skin, quiet heat' },
  { name: 'Woody', subtitle: 'Cedarwood, vetiver roots, dry bark' },
  { name: 'Aquatic', subtitle: 'Marine mist, rain-washed stone, cool ozonic' },
  { name: 'Sweet', subtitle: 'Velvet fig, vanilla bean, soft nectar' },
  { name: 'Floral', subtitle: 'Neroli petals, jasmine dusk, tuberose' },
] as const;

export const CUSTOM_CHARACTERS = [
  { value: 'Soft & Subtle', detail: 'Close to the skin, delicate and intimate' },
  { value: 'Balanced & Versatile', detail: 'Even trail suited from morning to evening' },
  { value: 'Bold & Expressive', detail: 'Richer projection that commands the room' },
] as const;

export const CUSTOM_NOTES = [
  'Citrus',
  'Bergamot',
  'Rose',
  'Jasmine',
  'Sandalwood',
  'Oud',
  'Vanilla',
  'Musk',
  'Amber',
  'Vetiver',
] as const;

export const CUSTOM_INTENSITIES = [
  { value: 'Light', detail: 'Airy skin mist that wears effortlessly' },
  { value: 'Moderate', detail: 'Noticeable heart notes through the day' },
  { value: 'Strong', detail: 'Deep concentration designed to linger' },
] as const;

export const CUSTOM_OCCASIONS = [
  'Everyday Wear',
  'Office / Professional',
  'Evening / Special Occasion',
  'Gifting',
  'Versatile / All Occasions',
] as const;

export const CUSTOM_PACKAGING = [
  { value: 'Standard Packaging', detail: 'Atelier linen pouch & protective studio sleeve' },
  { value: 'Gift Packaging', detail: 'Presentation box finished for gifting (confirming final availability)' },
] as const;

export const BOTTLE_LABEL_MAX = 30;
export const BOTTLE_LABEL_PATTERN = /^[A-Za-z0-9 '\-&.,!]+$/;

export interface CustomBottleSizeOption {
  size_ml: 50 | 100 | 150;
  label: string;
  price_inr: number;
  is_available: boolean;
  is_provisional: boolean;
  availability_note: string;
}

export const PROVISIONAL_SIZES: readonly CustomBottleSizeOption[] = [
  {
    size_ml: 50,
    label: '50 ml',
    price_inr: 1290,
    is_available: true,
    is_provisional: true,
    availability_note: 'Provisional custom blend estimate; confirmed by studio',
  },
  {
    size_ml: 100,
    label: '100 ml',
    price_inr: 1890,
    is_available: true,
    is_provisional: true,
    availability_note: 'Provisional custom blend estimate; confirmed by studio',
  },
  {
    size_ml: 150,
    label: '150 ml',
    price_inr: 2390,
    is_available: true,
    is_provisional: true,
    availability_note: 'Provisional custom blend estimate; confirmed by studio',
  },
];

export type CustomCharacter = (typeof CUSTOM_CHARACTERS)[number]['value'];
export type CustomIntensity = (typeof CUSTOM_INTENSITIES)[number]['value'];
export type CustomOccasion = (typeof CUSTOM_OCCASIONS)[number];
export type CustomPackaging = (typeof CUSTOM_PACKAGING)[number]['value'];

export interface CustomPerfumeDraft {
  families: string[];
  character: CustomCharacter | '';
  preferredNotes: string[];
  notesToAvoid: string;
  intensity: CustomIntensity | '';
  occasion: CustomOccasion | '';
  bottleSizeMl: number | null;
  bottleLabel: string;
  packaging: CustomPackaging;
  additionalInstructions: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  consentAccepted: boolean;
}

export function createInitialDraft(initialLabel = ''): CustomPerfumeDraft {
  return {
    families: [],
    character: '',
    preferredNotes: [],
    notesToAvoid: '',
    intensity: '',
    occasion: '',
    bottleSizeMl: 50,
    bottleLabel: initialLabel.slice(0, BOTTLE_LABEL_MAX),
    packaging: 'Standard Packaging',
    additionalInstructions: '',
    fullName: '',
    mobileNumber: '',
    email: '',
    consentAccepted: false,
  };
}

export function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/[<>]/g, '').trim().slice(0, maxLength);
}

export function validateBottleLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (trimmed.length > BOTTLE_LABEL_MAX) {
    return `Keep your fragrance name within ${BOTTLE_LABEL_MAX} characters.`;
  }
  if (!BOTTLE_LABEL_PATTERN.test(trimmed)) {
    return "Use letters, numbers, spaces, or ' - & . , ! characters only.";
  }
  return null;
}

export function validateInternationalPhone(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Enter your mobile or WhatsApp number.';
  if (!/^[+\d()\s-]+$/.test(value)) {
    return 'Use digits, spaces, +, -, or parentheses only.';
  }
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Enter a valid mobile or WhatsApp number (7 to 15 digits, with country code if outside India).';
  }
  return null;
}

export function validateOptionalEmail(raw: string, required = false): string | null {
  const value = raw.trim();
  if (!value) return required ? 'Enter your email address so we can send your price & invoice.' : null;
  if (!/^\S+@\S+\.\S+$/.test(value)) return 'Enter a valid email address.';
  return null;
}

export function validateStep1(draft: CustomPerfumeDraft): { families?: string; character?: string } {
  const errs: { families?: string; character?: string } = {};
  if (draft.families.length === 0) errs.families = 'Select at least one fragrance family to continue.';
  if (!draft.character) errs.character = 'Choose a fragrance character to continue.';
  return errs;
}

export function validateStep2(draft: CustomPerfumeDraft): { intensity?: string } {
  const errs: { intensity?: string } = {};
  if (!draft.intensity) errs.intensity = 'Select your preferred fragrance intensity.';
  return errs;
}

export function validateStep3(
  draft: CustomPerfumeDraft,
  sizes: readonly CustomBottleSizeOption[],
): { bottleSizeMl?: string; bottleLabel?: string; packaging?: string } {
  const errs: { bottleSizeMl?: string; bottleLabel?: string; packaging?: string } = {};
  const match = sizes.find((s) => s.size_ml === draft.bottleSizeMl && s.is_available);
  if (!match) errs.bottleSizeMl = 'Select an available bottle size.';
  const labelErr = validateBottleLabel(draft.bottleLabel);
  if (labelErr) errs.bottleLabel = labelErr;
  if (!draft.packaging) errs.packaging = 'Select a packaging preference.';
  return errs;
}

export function validateStep4Contact(
  draft: CustomPerfumeDraft,
  requireEmail = false,
): { fullName?: string; mobileNumber?: string; email?: string; consentAccepted?: string } {
  const errs: { fullName?: string; mobileNumber?: string; email?: string; consentAccepted?: string } = {};
  if (draft.fullName.trim().length < 2) errs.fullName = 'Enter your full name.';
  const phoneErr = validateInternationalPhone(draft.mobileNumber);
  if (phoneErr) errs.mobileNumber = phoneErr;
  const emailErr = validateOptionalEmail(draft.email, requireEmail);
  if (emailErr) errs.email = emailErr;
  if (!draft.consentAccepted) {
    errs.consentAccepted = 'Please agree to be contacted about your personalized perfume request and acknowledge our Privacy Policy.';
  }
  return errs;
}

export async function fetchCustomPerfumeSizes(): Promise<CustomBottleSizeOption[]> {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('custom_perfume_sizes')
      .select('size_ml, label, price_inr, is_available, is_provisional, availability_note')
      .order('size_ml', { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) return [...PROVISIONAL_SIZES];
    return data.map((row) => ({
      size_ml: Number(row.size_ml) as 50 | 100 | 150,
      label: String(row.label),
      price_inr: Number(row.price_inr),
      is_available: Boolean(row.is_available),
      is_provisional: Boolean(row.is_provisional),
      availability_note: String(row.availability_note || ''),
    }));
  } catch {
    return [...PROVISIONAL_SIZES];
  }
}

export interface CustomOrderConfirmation extends PlacedOrderReceipt {
  requestId: string;
  requestRef: string;
  requestStatus: string;
}

export async function submitCustomPerfumeOrder(params: {
  draft: CustomPerfumeDraft;
  shippingAddress: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  upiReference?: string;
}): Promise<CustomOrderConfirmation> {
  const client = await getCustomerSupabase();
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) {
    throw new Error('Please sign in or create an account to place your custom perfume order.');
  }

  const { draft } = params;
  const payload = {
    fullName: sanitizeText(draft.fullName, 120),
    mobileNumber: sanitizeText(draft.mobileNumber, 30),
    email: sanitizeText(draft.email, 160),
    shippingAddress: sanitizeText(params.shippingAddress, 300),
    city: sanitizeText(params.city, 100),
    state: sanitizeText(params.state, 100),
    pincode: sanitizeText(params.pincode, 12),
    paymentMethod: params.paymentMethod,
    upiReference: params.paymentMethod === 'upi' ? sanitizeText(params.upiReference ?? '', 30) : null,
    families: draft.families,
    fragranceCharacter: draft.character,
    preferredNotes: draft.preferredNotes,
    notesToAvoid: sanitizeText(draft.notesToAvoid, 250),
    intensity: draft.intensity,
    occasion: draft.occasion || null,
    bottleSizeMl: draft.bottleSizeMl,
    bottleLabel: sanitizeText(draft.bottleLabel, BOTTLE_LABEL_MAX),
    packaging: draft.packaging,
    additionalInstructions: sanitizeText(draft.additionalInstructions, 600),
    consentAccepted: draft.consentAccepted,
  };

  const { data, error } = await client.rpc('create_custom_perfume_order', { p_payload: payload });
  if (error) throw new Error(error.message || 'Could not submit your personalized perfume order.');

  const res = data as {
    request_id: string;
    request_ref: string;
    order_id: string;
    outbox_id: string;
    order_number: string;
    invoice_number: string;
    payment_method: PaymentMethod;
    payment_status: string;
    order_status: string;
    request_status: string;
    subtotal_inr: number;
    shipping_inr: number;
    total_inr: number;
    created_at: string;
    invoice_html: string;
    items: PlacedOrderReceipt['items'];
  };

  const emailRes = await dispatchInvoiceEmail({
    orderId: res.order_id,
    outboxId: res.outbox_id,
    orderNumber: res.order_number,
    invoiceNumber: res.invoice_number,
    recipientEmail: payload.email,
    recipientName: payload.fullName,
    invoiceHtml: res.invoice_html,
  });

  return {
    requestId: res.request_id,
    requestRef: res.request_ref,
    requestStatus: res.request_status,
    orderId: res.order_id,
    outboxId: res.outbox_id,
    orderNumber: res.order_number,
    invoiceNumber: res.invoice_number,
    customerName: payload.fullName,
    customerEmail: payload.email,
    paymentMethod: res.payment_method,
    paymentStatus: res.payment_status,
    orderStatus: res.order_status,
    upiReference: params.paymentMethod === 'upi' ? payload.upiReference : null,
    subtotalInr: Number(res.subtotal_inr),
    shippingInr: Number(res.shipping_inr),
    totalInr: Number(res.total_inr),
    createdAt: res.created_at,
    invoiceHtml: res.invoice_html,
    emailStatus: emailRes.status,
    emailMessage: emailRes.message,
    items: res.items,
  };
}

