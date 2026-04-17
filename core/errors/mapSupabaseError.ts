const GENERIC = 'Что-то пошло не так. Попробуйте ещё раз.';

export function mapAuthError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверный email или пароль.';
  if (m.includes('email not confirmed')) return 'Подтвердите email по ссылке из письма.';
  if (m.includes('user already registered')) return 'Этот email уже зарегистрирован.';
  if (m.includes('password')) return 'Пароль слишком короткий или не подходит по правилам.';
  if (m.includes('network')) return 'Нет соединения. Проверьте интернет.';
  return GENERIC;
}

export function mapNetworkError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message?: string }).message);
    if (/network|fetch|failed/i.test(msg)) return 'Нет соединения. Проверьте интернет.';
  }
  return GENERIC;
}

export function mapQueryError(error: Error | null | undefined): string {
  if (!error) return GENERIC;
  const m = error.message;
  if (/fetch|network|failed|load failed/i.test(m)) return 'Нет соединения. Проверьте интернет.';
  if (/jwt|session|not authenticated/i.test(m)) return 'Войдите ещё раз.';
  return 'Не удалось загрузить данные. Попробуйте позже.';
}
