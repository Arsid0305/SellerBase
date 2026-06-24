import { Suspense } from 'react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { LoginForm } from './login-form';

export const metadata = { title: 'Вход' };

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <PageHeader title="Вход в SellerBase" description="Email и пароль" />
      <Suspense fallback={null}>
        <ErrorBanner searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </div>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  if (!params.error) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      Ошибка авторизации: {params.error}
    </div>
  );
}
