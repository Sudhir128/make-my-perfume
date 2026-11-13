/**
 * Vercel serverless function: serves /api/config in production, the same
 * contract the Vite dev and preview servers provide locally (see
 * runtimeConfigPlugin in vite.config.ts). Credentials come from the host's
 * environment variables, so they are never committed or bundled.
 *
 * Set SUPABASE_PROJECT_URL and SUPABASE_ANON_KEY in the Vercel project
 * settings. The anon key is a public, row-level-security-governed key; never
 * add the service_role key here.
 */
export default function handler(req, res) {
  const projectUrl = process.env.SUPABASE_PROJECT_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const merchantUpiId = process.env.MERCHANT_UPI_ID || 'makemyperfume@upi';
  const merchantName = process.env.MERCHANT_NAME || 'Make My Perfume';
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify({ projectUrl, anonKey, merchantUpiId, merchantName }));
}
