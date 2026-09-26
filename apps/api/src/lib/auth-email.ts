import type { AppBindings } from '../env';

type PasswordResetMessage = {
  to: string;
  url: string;
};

export async function sendPasswordResetEmail(
  env: AppBindings,
  message: PasswordResetMessage,
) {
  if (env.RESEND_API_KEY && env.AUTH_EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.AUTH_EMAIL_FROM,
        to: [message.to],
        subject: 'Redefina sua senha do Bubo',
        text: [
          'Recebemos um pedido para redefinir sua senha do Bubo.',
          '',
          'Abra este link no dispositivo com o Bubo instalado:',
          message.url,
          '',
          'Se você não pediu isso, pode ignorar esta mensagem.',
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      throw new Error(`Password reset email failed with HTTP ${response.status}`);
    }
    return;
  }

  if (env.APP_ENV !== 'production' && env.AUTH_DEV_LOG_RESET_URLS === 'true') {
    console.warn('[Bubo auth/dev] password-reset URL:', message.url);
    return;
  }

  throw new Error(
    'Password reset email transport is not configured. Configure RESEND_API_KEY and AUTH_EMAIL_FROM.',
  );
}
