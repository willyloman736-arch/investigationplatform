"use client";

import * as React from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";

import {
  savePushSubscription,
  deletePushSubscription,
} from "@/lib/actions/notifications";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "unsupported" | "default" | "granted" | "denied" | "loading";

/**
 * Web Push opt-in control (rendered inside the notification dropdown). Registers
 * /sw.js, requests permission, subscribes via the PushManager, and persists the
 * subscription server-side. No-ops gracefully when push isn't supported or
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't configured.
 */
export function PushOptIn() {
  const [state, setState] = React.useState<State>("loading");

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined" ||
      !VAPID_PUBLIC_KEY
    ) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as State);
  }, []);

  const enable = async () => {
    if (!VAPID_PUBLIC_KEY) return;
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission as State);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        ) as BufferSource,
      });
      const json = sub.toJSON();
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      setState("granted");
    } catch {
      setState("default");
    }
  };

  const disable = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch {
      // ignore
    }
    setState("default");
  };

  if (state === "unsupported") {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Device push isn&apos;t available in this browser.
      </p>
    );
  }
  if (state === "loading") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Working…
      </span>
    );
  }
  if (state === "denied") {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Device push is blocked. Allow notifications for this site in your browser
        settings to enable it.
      </p>
    );
  }
  if (state === "granted") {
    return (
      <button
        type="button"
        onClick={disable}
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
        Turn off device push
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={enable}
      className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
    >
      <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
      Enable device push notifications
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export default PushOptIn;
