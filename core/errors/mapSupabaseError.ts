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
  if (/fetch|network|failed|load failed|aborted|timeout|econnrefused|enotfound/i.test(m)) {
    return 'Нет соединения. Проверьте интернет.';
  }
  if (/jwt|session|not authenticated|invalid\s+refresh|refresh\s+token/i.test(m)) {
    return 'Войдите ещё раз.';
  }
  if (/row\s+level\s+security|permission\s+denied|42501|pgrst301|rls/i.test(m)) {
    return 'Нет доступа к данным. Войдите ещё раз или обратитесь в поддержку.';
  }
  if (/pgrst116|0\s+rows/i.test(m)) return 'Запись не найдена.';
  if (/duplicate|unique|23505/i.test(m)) return 'Такая запись уже существует.';
  if (/could not find the function|42883|find_or_create_peer_chat|schema cache.*function/i.test(m)) {
    return 'На сервере нет функции чатов. В Supabase выполните SQL из репозитория: find_or_create_peer_chat (файл supabase_schema.sql).';
  }
  if (/could not find|embed|relationship.*chats|relationship.*chat_members|pgrst200|pgrst204/i.test(m)) {
    return 'Сервер отклонил запрос к таблицам чатов. Проверьте RLS и связи chats / chat_members в Supabase.';
  }
  if (/infinite recursion|42p17/i.test(m)) {
    return 'Ошибка политик RLS (возможна рекурсия). Обновите политику SELECT для chat_members в supabase_schema.sql.';
  }
  if (/42703|column.*does not exist/i.test(m)) {
    return 'Схема базы не совпадает с приложением (нет колонки или таблицы).';
  }
  return 'Не удалось загрузить данные. Попробуйте позже.';
}
