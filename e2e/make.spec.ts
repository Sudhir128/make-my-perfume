import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { disablePointerLock, measureTextContrast, scrollThrough, settle, watchErrors } from './helpers';

const LAB = process.env.MAKE_LAB ?? 'scrollcraft/lab/make';
fs.mkdirSync(LAB, { recursive: true });

test.beforeEach(async ({ page }) => {
  await disablePointerLock(page);
});

const TEST_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'compact', width: 360, height: 640 },
] as const;

test.describe('Create Your Perfume (/make)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('completes 4-step journey, validates, preserves edits, opens payment (COD/UPI) after login, and confirms invoice', async ({ page }) => {
    const errors = watchErrors(page);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projectUrl: 'https://mock-supabase.local',
          anonKey: 'mock-anon-key',
          merchantUpiId: 'makemyperfume@upi',
          merchantName: 'Make My Perfume',
        }),
      });
    });
    await page.route('https://mock-supabase.local/rest/v1/custom_perfume_sizes**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { size_ml: 50, label: '50 ml', price_inr: 1290, is_available: true, is_provisional: true, availability_note: 'Provisional rate' },
          { size_ml: 100, label: '100 ml', price_inr: 1890, is_available: true, is_provisional: true, availability_note: 'Provisional rate' },
          { size_ml: 150, label: '150 ml', price_inr: 2390, is_available: true, is_provisional: true, availability_note: 'Provisional rate' },
        ]),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-customer',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-customer',
          user: { id: 'cust-1', email: 'meera@example.com', user_metadata: { full_name: 'Meera Krishnan' } },
        }),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'cust-1', email: 'meera@example.com', user_metadata: { full_name: 'Meera Krishnan' } }),
      });
    });
    await page.route('**/rest/v1/rpc/create_custom_perfume_order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          request_id: 'req-101',
          request_ref: 'MMP-REQ-20261112-AB12CD',
          order_id: 'ord-101',
          outbox_id: 'out-101',
          order_number: 'MMP-CUS-20261112-XY7890',
          invoice_number: 'INV-20261112-XY7890',
          payment_method: 'upi',
          payment_status: 'awaiting_verification',
          order_status: 'placed',
          request_status: 'pending_review',
          subtotal_inr: 1890,
          shipping_inr: 0,
          total_inr: 1890,
          created_at: '2026-11-12T10:00:00Z',
          invoice_html: '<!doctype html><html><body><h1>Personalised Invoice INV-20261112-XY7890</h1></body></html>',
          items: [{ product_slug: 'make', product_name: 'Personalised Perfume — Midnight Silk', size_ml: 100, unit_price_inr: 1890, quantity: 1, line_total_inr: 1890 }],
        }),
      });
    });
    await page.route('**/api/send-invoice', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dispatched: true, status: 'sent' }) });
    });
    await page.route('**/rest/v1/rpc/mark_order_email_status', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await page.goto('/make?name=Meera');
    await settle(page);
    await expect(page.getByRole('heading', { level: 1, name: /Create\s*Your Perfume/ })).toBeVisible();

    // Step 1: Validation then selection
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Select at least one fragrance family to continue.')).toBeVisible();
    await page.getByRole('checkbox', { name: /Warm/ }).click();
    await page.getByRole('checkbox', { name: /Woody/ }).click();
    await page.getByRole('radio', { name: /Balanced & Versatile/ }).click();
    await page.screenshot({ path: `${LAB}/make-step1-desktop.png` });
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Scent Preferences
    await expect(page.getByRole('heading', { level: 2, name: /Define\s*Your Scent/ })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Select your preferred fragrance intensity.')).toBeVisible();
    await page.getByRole('button', { name: 'Bergamot', exact: true }).click();
    await page.getByRole('button', { name: 'Sandalwood', exact: true }).click();
    await page.getByLabel(/Notes to avoid/).fill('Heavy vanilla');
    await page.getByRole('radio', { name: /Moderate/ }).click();
    await page.getByRole('button', { name: 'Evening / Special Occasion', exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Bottle Personalization
    await expect(page.getByRole('heading', { level: 2, name: /Make It\s*Yours/ })).toBeVisible();
    const labelInput = page.getByLabel('Name Your Fragrance');
    await expect(labelInput).toHaveValue('Meera');
    await labelInput.fill('Bad <Tag>');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/Use letters, numbers, spaces/)).toBeVisible();
    await labelInput.fill('Midnight Silk');
    await page.getByRole('radio', { name: /100 ml/ }).click();
    await page.getByRole('radio', { name: /Gift Packaging/ }).click();
    await page.getByLabel(/Anything else we should know/).fill('Prefer dry cedar drydown.');
    await page.screenshot({ path: `${LAB}/make-step3-desktop.png` });
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4: Review & Edit preservation check
    await expect(page.getByRole('heading', { level: 2, name: /Your Signature\s*Fragrance/ })).toBeVisible();
    await expect(page.getByText('Warm, Woody')).toBeVisible();
    await expect(page.getByText('Bergamot, Sandalwood')).toBeVisible();
    await expect(page.getByText('Midnight Silk')).toBeVisible();

    // Edit step 2 and return with preserved state
    await page.getByRole('button', { name: 'Edit' }).nth(1).click();
    await expect(page.getByLabel(/Notes to avoid/)).toHaveValue('Heavy vanilla');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Contact validation including international WhatsApp number
    await page.getByLabel('Full Name').fill('Meera Krishnan');
    await page.getByLabel(/Mobile \/ WhatsApp Number/).fill('12');
    await page.getByRole('button', { name: 'CREATE MY PERFUME' }).click();
    await expect(page.getByText(/7 to 15 digits/)).toBeVisible();

    await page.getByLabel(/Mobile \/ WhatsApp Number/).fill('+971 50 123 4567');
    await page.getByLabel(/I agree to be contacted/).check();
    await page.screenshot({ path: `${LAB}/make-step4-desktop.png` });
    await page.getByRole('button', { name: 'CREATE MY PERFUME' }).click();

    // Post-create dialog: Auth gate -> Payment (COD / UPI) -> Confirmation
    const authDialog = page.getByRole('dialog', { name: /Sign in\s*to continue/ });
    await expect(authDialog).toBeVisible();
    await authDialog.getByLabel('Email').fill('meera@example.com');
    await authDialog.getByLabel('Password').fill('secret123');
    await authDialog.getByRole('button', { name: 'Log in & continue' }).click();

    const payDialog = page.getByRole('dialog', { name: /Payment &\s*Delivery/ });
    await expect(payDialog).toBeVisible();
    await payDialog.getByLabel('Delivery address').fill('14 Boat Club Road');
    await payDialog.getByLabel('City').fill('Chennai');
    await payDialog.getByLabel(/State/).fill('Tamil Nadu');
    await payDialog.getByLabel(/PIN/).fill('600001');
    await payDialog.getByLabel(/UPI \(GPay/).check();
    await expect(payDialog.getByRole('img', { name: /UPI QR code/ })).toBeVisible();
    await payDialog.getByLabel(/UPI Transaction ID/).fill('412890123456');
    await payDialog.getByRole('button', { name: /Confirm & place custom order/ }).click();

    await expect(page.getByRole('heading', { level: 1, name: /Your fragrance journey\s*begins here\./ })).toBeVisible();
    await expect(page.getByText('MMP-REQ-20261112-AB12CD', { exact: true })).toBeVisible();
    await expect(page.getByText('MMP-CUS-20261112-XY7890', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print Invoice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Invoice (PDF)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download HTML' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Invoice (PDF)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('INV-20261112-XY7890.pdf');

    await page.screenshot({ path: `${LAB}/make-success-desktop.png` });
    expect(errors).toEqual([]);
  });

  test('admin panel Personalised Perfumes tab displays bespoke orders cleanly (mocked admin RPCs)', async ({ page }) => {
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projectUrl: 'https://mock-supabase.local', anonKey: 'mock-anon-key' }),
      });
    });
    await page.route('https://mock-supabase.local/rest/v1/rpc/admin_status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, is_admin: true, has_any_admin: true, email: 'admin@makemyperfume.in' }),
      });
    });
    for (const rpc of ['admin_list_products', 'admin_list_orders', 'admin_list_activity_logs', 'admin_list_admins']) {
      await page.route(`**/rest/v1/rpc/${rpc}`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
    }
    await page.route('**/rest/v1/rpc/admin_list_taxonomy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ categories: [], fragrance_types: [], scent_families: [] }),
      });
    });
    await page.route('https://mock-supabase.local/rest/v1/custom_perfume_sizes**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ size_ml: 100, label: '100 ml', price_inr: 1890, is_available: true, is_provisional: true, availability_note: 'Provisional' }]),
      });
    });
    await page.route('**/rest/v1/rpc/admin_list_personalised_orders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'req-101',
            request_ref: 'MMP-REQ-20261112-AB12CD',
            order_id: 'ord-101',
            full_name: 'Meera Krishnan',
            mobile_number: '+971 50 123 4567',
            email: 'meera@example.com',
            families: ['Warm', 'Woody'],
            fragrance_character: 'Balanced & Versatile',
            preferred_notes: ['Bergamot', 'Sandalwood'],
            notes_to_avoid: 'Heavy vanilla',
            intensity: 'Moderate',
            occasion: 'Evening / Special Occasion',
            bottle_size_ml: 100,
            bottle_label: 'Midnight Silk',
            packaging: 'Gift Packaging',
            additional_instructions: null,
            consent_accepted: true,
            consent_at: '2026-11-12T10:00:00Z',
            request_status: 'pending_review',
            quoted_price_inr: 1890,
            staff_notes: null,
            created_at: '2026-11-12T10:00:00Z',
            order_number: 'MMP-CUS-20261112-XY7890',
            invoice_number: 'INV-20261112-XY7890',
            shipping_address: '14 Boat Club Road',
            city: 'Chennai',
            state: 'Tamil Nadu',
            pincode: '600001',
            payment_method: 'upi',
            payment_status: 'awaiting_verification',
            upi_reference: '412890123456',
            order_status: 'placed',
            total_inr: 1890,
            invoice_html: '<html><body>Invoice</body></html>',
            email_status: 'sent',
            outbox_id: 'out-101',
          },
        ]),
      });
    });

    await page.goto('/admin');
    await page.getByRole('button', { name: /Personalised Perfumes \(1\)/ }).click();
    await expect(page.getByText('MMP-REQ-20261112-AB12CD')).toBeVisible();
    await expect(page.getByText('Midnight Silk')).toBeVisible();
    await expect(page.getByLabel('Quoted INR for MMP-REQ-20261112-AB12CD')).toHaveValue('1890');
  });
});

for (const vp of TEST_VIEWPORTS) {
  test.describe(`/make responsive + a11y (${vp.name} ${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('no horizontal overflow, passes axe WCAG AA & text contrast', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto('/make');
      await settle(page);
      await scrollThrough(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      const contrast = await measureTextContrast(page);
      expect(contrast.filter((c) => c.ratio < c.min)).toEqual([]);
      await page.screenshot({ path: `${LAB}/make-${vp.name}.png`, fullPage: true });
      expect(errors).toEqual([]);
    });
  });
}

test.describe('/make reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('renders cleanly with zero overflow under reduced motion', async ({ page }) => {
    await page.goto('/make');
    await settle(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});

