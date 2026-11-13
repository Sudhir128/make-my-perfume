import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { dispatchInvoiceEmailPayload } from './api/send-invoice.js';

declare const process: {
  env: Record<string, string | undefined>;
  cwd: () => string;
};

declare const Buffer: {
  concat(list: Uint8Array[]): { toString(encoding?: string): string };
};

/**
 * Serves runtime configuration (/api/config) and server-side invoice dispatch (/api/send-invoice).
 * Keeps secrets in .env.local / host environment out of compiled client bundles.
 */
function runtimeConfigPlugin(): Plugin {
  const readJsonBody = (req: any) =>
    new Promise<any>((resolve, reject) => {
      const chunks: any[] = [];
      req.on('data', (c: any) => chunks.push(c));
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });

  const handler = async (req: any, res: any, next: () => void) => {
    const url = req.url?.split('?')[0];
    const mode = process.env.NODE_ENV || 'development';
    const env = loadEnv(mode, process.cwd(), '');

    if (url === '/api/config') {
      const config = {
        projectUrl: process.env.SUPABASE_PROJECT_URL || env.SUPABASE_PROJECT_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '',
        merchantUpiId: process.env.MERCHANT_UPI_ID || env.MERCHANT_UPI_ID || 'makemyperfume@upi',
        merchantName: process.env.MERCHANT_NAME || env.MERCHANT_NAME || 'Make My Perfume',
      };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(config));
      return;
    }

    if (url === '/api/send-invoice' && req.method === 'POST') {
      try {
        for (const k of ['RESEND_API_KEY', 'SENDGRID_API_KEY', 'ORDER_FROM_EMAIL']) {
          if (!process.env[k] && env[k]) process.env[k] = env[k];
        }
        const body = await readJsonBody(req);
        const result = await dispatchInvoiceEmailPayload(body);
        res.statusCode = result.statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result.payload));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ dispatched: false, status: 'failed', message: err instanceof Error ? err.message : 'Invalid payload' }));
      }
      return;
    }

    next();
  };

  return {
    name: 'runtime-config-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), runtimeConfigPlugin()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Unit tests never reach the network: they read the bundled catalogue.
    env: { VITE_CATALOGUE_SOURCE: 'local' },
    // Vitest blanks CSS by default, even with ?raw. The contrast test reads the
    // real token file, so let it through.
    css: { include: [/tokens\.css/] },
  },
});
