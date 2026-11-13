/*
 * Safe public telemetry logger for the Admin Portal Activity Log.
 * Fires silently to Supabase RPC `log_site_activity`; never blocks UX or unit tests.
 */
import { catalogueSource } from './catalogue';
import { getSupabase } from '../lib/supabase';

export type PublicActivityAction =
  | 'catalogue.searched'
  | 'product.viewed'
  | 'bag.item_added'
  | 'checkout.started'
  | 'page.visited';

export function trackSiteActivity(
  action: PublicActivityAction,
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata: Record<string, unknown> = {},
): void {
  if (catalogueSource() === 'local') return;
  if (typeof window === 'undefined') return;
  void getSupabase()
    .then((client) =>
      client.rpc('log_site_activity', {
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_summary: summary,
        p_metadata: metadata,
      }),
    )
    .catch(() => {});
}

