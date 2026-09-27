import { z } from 'zod';

/** Better Auth client error shape (subset we rely on). */
export type AuthClientError =
  { status?: number; code?: string; message?: string } | null | undefined;

/** Maps auth failures to friendly pt-BR copy. Never shows raw server messages. */
export function authErrorMessage(error: AuthClientError): string {
  if (!error) return 'Algo deu errado. Tente novamente.';
  const code = error.code ?? '';
  if (error.status === 429) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return 'E-mail ou senha incorretos.';
  if (code.startsWith('USER_ALREADY_EXISTS'))
    return 'Já existe uma conta com esse e-mail. Que tal entrar?';
  if (code === 'PASSWORD_TOO_SHORT') return 'A senha precisa ter pelo menos 8 caracteres.';
  if (code === 'PASSWORD_TOO_LONG') return 'A senha pode ter no máximo 128 caracteres.';
  if (code === 'INVALID_TOKEN') return 'Esse link é inválido ou expirou. Peça um novo link.';
  if (code === 'INVALID_EMAIL') return 'Informe um e-mail válido.';
  if (error.status === 403)
    return 'Não foi possível concluir por segurança. Tente novamente pelo app.';
  if (error.status === 503) return 'O serviço está indisponível no momento. Tente mais tarde.';
  if (!error.status) return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Algo deu errado. Tente novamente.';
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Informe um e-mail válido.'));
export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(128, 'A senha pode ter no máximo 128 caracteres.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Como podemos te chamar?').max(80, 'Use até 80 caracteres.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });

/** First message per top-level field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}
