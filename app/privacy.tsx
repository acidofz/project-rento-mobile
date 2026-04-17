import { LegalWebDocument } from '@/components/legal/LegalWebDocument';
import { WEB_PRIVACY_URL } from '@/core/config/legal';

const FALLBACK =
  'Здесь будет политика персональных данных: аккаунт, объявления, переписка, фото; хранение через Supabase; сроки и права пользователя. Основа — /privacy на сайте; финальный текст — с юристом и под формы приватности в сторах.';

export default function PrivacyScreen() {
  return <LegalWebDocument uri={WEB_PRIVACY_URL} staticFallback={FALLBACK} />;
}
