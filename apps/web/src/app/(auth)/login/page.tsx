import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Вход' };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <PageHeader title="Вход в SellerBase" description="Magic link или Google OAuth · скоро" />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Auth подключится в следующем PR
      </div>
    </div>
  );
}
