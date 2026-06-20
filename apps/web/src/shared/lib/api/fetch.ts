/**
 * Server-side fetch обёртка которая автоматически подкладывает X-API-Secret для внутренних
 * server-to-server вызовов на /api/**. Использовать ТОЛЬКО в Server Components / Server Actions /
 * API routes — НИКОГДА в `'use client'` файлах (секрет утечёт в браузерный bundle).
 */
export async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const secret = process.env.API_SECRET;
  const headers = new Headers(init?.headers);
  if (secret && !headers.has('X-API-Secret')) {
    headers.set('X-API-Secret', secret);
  }
  return fetch(input, { ...init, headers });
}
