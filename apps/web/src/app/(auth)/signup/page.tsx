import { PageHeader } from '@/widgets/app-shell/page-header';
import { SignupForm } from './signup-form';

export const metadata = { title: 'Регистрация' };
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <PageHeader
        title="Регистрация SellerBase"
        description="Одноразовая форма — после первой регистрации закрыта"
      />
      <SignupForm />
    </div>
  );
}
