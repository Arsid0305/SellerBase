import { PageHeader } from '@/widgets/app-shell/page-header';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Новый пароль' };
export const dynamic = 'force-dynamic';

/**
 * Куда приводит ссылка из письма «Забыли пароль».
 *
 * К этому моменту человек уже вошёл: ссылку обменял на сессию
 * /auth/callback. Здесь остаётся только задать новый пароль.
 */
export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <PageHeader
        title="Новый пароль"
        description="Придумай пароль и запиши его - входить будешь им"
      />
      <ResetPasswordForm />
    </div>
  );
}
