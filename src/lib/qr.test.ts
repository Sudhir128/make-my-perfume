import { describe, expect, it } from 'vitest';
import { generateQrMatrix } from './qr';

describe('generateQrMatrix', () => {
  it('generates a valid square QR matrix with intact finder corners for UPI URIs', () => {
    const uri = 'upi://pay?pa=makemyperfume@upi&pn=Make+My+Perfume&am=1490&cu=INR&tn=Order';
    const qr = generateQrMatrix(uri);
    expect(qr.size).toBeGreaterThanOrEqual(25);
    expect(qr.modules).toHaveLength(qr.size * qr.size);
    // Top-left finder corner center & borders are dark (1)
    expect(qr.modules[0]).toBe(1);
    expect(qr.modules[3 * qr.size + 3]).toBe(1);
    // Top-right finder corner
    expect(qr.modules[qr.size - 1]).toBe(1);
    // Bottom-left finder corner
    expect(qr.modules[(qr.size - 1) * qr.size]).toBe(1);
  });
});

