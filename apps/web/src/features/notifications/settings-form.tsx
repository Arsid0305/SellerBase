'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { NotificationSettings, TelegramStatus } from '@/entities/notifications';
import { PushSubscribeButton } from './push-subscribe-button';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 transform rounded-full bg-background shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function NotificationSettingsForm({
  initial,
  telegram,
}: {
  initial: NotificationSettings;
  telegram: TelegramStatus;
}) {
  const [settings, setSettings] = useState<NotificationSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function patch(p: Partial<NotificationSettings>) {
    setSettings((s) => ({ ...s, ...p }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = (await res.json()) as { settings: NotificationSettings };
        setSettings(data.settings);
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Каналы</CardTitle>
          <CardDescription>Где получать уведомления о критичных событиях.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <Toggle
            label="Колокольчик в приложении"
            description="Список уведомлений в шапке"
            checked={settings.bellEnabled}
            onChange={(v) => patch({ bellEnabled: v })}
          />
          <Toggle
            label="Telegram"
            description="Бот @SellerBase_bot"
            checked={settings.telegramEnabled}
            onChange={(v) => patch({ telegramEnabled: v })}
          />
          <Toggle
            label="Web Push"
            description="Push-уведомления браузера"
            checked={settings.pushEnabled}
            onChange={(v) => patch({ pushEnabled: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Тихие часы</CardTitle>
          <CardDescription>
            В этом интервале (МСК) обычные уведомления не отправляются в Telegram и Push — только в
            колокольчик. Критичные приходят всегда.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">С</span>
            <select
              value={settings.quietFrom}
              onChange={(e) => patch({ quietFrom: Number(e.target.value) })}
              className="h-9 rounded-md border border-input bg-background px-3"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">до</span>
            <select
              value={settings.quietTo}
              onChange={(e) => patch({ quietTo: Number(e.target.value) })}
              className="h-9 rounded-md border border-input bg-background px-3"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>Статус подписки на бота.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {telegram.connected ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full',
                  telegram.active ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
              {telegram.active ? 'Подключён и активен' : 'Подключён, но на паузе (/unmute в боте)'}
            </div>
          ) : (
            <div className="text-muted-foreground">
              Не подключён. Откройте бота{' '}
              <a
                href="https://t.me/SellerBase_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                @SellerBase_bot
              </a>{' '}
              и отправьте команду <code className="rounded bg-muted px-1">/start</code>.
            </div>
          )}
          <div>
            <Button variant="outline" size="sm" asChild>
              <a href="https://t.me/SellerBase_bot" target="_blank" rel="noopener noreferrer">
                <Send className="size-4" />
                Открыть @SellerBase_bot
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Web Push в этом браузере</CardTitle>
          <CardDescription>
            Разрешите уведомления, чтобы получать push даже когда вкладка закрыта.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushSubscribeButton />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить настройки'}
        </Button>
        {saved && <span className="text-sm text-emerald-600">Сохранено</span>}
      </div>
    </div>
  );
}
