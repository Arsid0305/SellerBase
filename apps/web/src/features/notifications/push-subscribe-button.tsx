'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { env } from '@/shared/lib/env';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'idle' | 'subscribing' | 'subscribed' | 'denied' | 'unsupported' | 'not-configured';

export function PushSubscribeButton() {
  const vapidKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (!vapidKey) {
      setState('not-configured');
      return;
    }
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'subscribed' : 'idle'))
      .catch(() => setState('idle'));
  }, [vapidKey]);

  async function subscribe() {
    if (!vapidKey) return;
    setState('subscribing');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? 'subscribed' : 'idle');
    } catch {
      setState('idle');
    }
  }

  if (state === 'not-configured') {
    return (
      <Button variant="outline" size="sm" disabled>
        <BellOff className="size-4" />
        Push не настроен
      </Button>
    );
  }
  if (state === 'unsupported') {
    return (
      <Button variant="outline" size="sm" disabled>
        <BellOff className="size-4" />
        Push не поддерживается браузером
      </Button>
    );
  }
  if (state === 'denied') {
    return (
      <Button variant="outline" size="sm" disabled>
        <BellOff className="size-4" />
        Push заблокирован в браузере
      </Button>
    );
  }
  if (state === 'subscribed') {
    return (
      <Button variant="secondary" size="sm" disabled>
        <BellRing className="size-4" />
        Push включён
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={subscribe} disabled={state === 'subscribing'}>
      <BellRing className="size-4" />
      {state === 'subscribing' ? 'Включаю…' : 'Включить push в браузере'}
    </Button>
  );
}
