// NEVER import in a client component — uses the VAPID private key.
// ─────────────────────────────────────────────────────────────────────────────
// Web Push sender. No-ops when VAPID keys are unset.
//
// Required env:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//     generate once with:  npx web-push generate-vapid-keys
//   VAPID_SUBJECT   a mailto: or https: contact, e.g. mailto:ops@yourdomain.com
//
// The PUBLIC key must ALSO be exposed to the browser as
// NEXT_PUBLIC_VAPID_PUBLIC_KEY (see components/dashboard/PushOptIn.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import webpush from "web-push";

import type { PushSubscriptionRow } from "@/lib/types";

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ||
      "mailto:notifications@digitalassetinvestigations.com",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push to every provided subscription. Best-effort: never throws.
 * Returns endpoints that are GONE (404/410) so callers can prune them.
 */
export async function sendPushToSubscriptions(
  subs: Pick<PushSubscriptionRow, "endpoint" | "p256dh" | "auth">[],
  payload: PushPayload
): Promise<{ goneEndpoints: string[] }> {
  const goneEndpoints: string[] = [];
  if (!ensureConfigured() || subs.length === 0) return { goneEndpoints };

  const data = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          goneEndpoints.push(s.endpoint);
        }
        // Other errors swallowed (best-effort).
      }
    })
  );

  return { goneEndpoints };
}
