import { LegalWebDocument } from '@/components/legal/LegalWebDocument';
import { WEB_TERMS_URL } from '@/core/config/legal';

const FALLBACK =
  'Здесь будет полный текст правил площадки RENTO. Возьмите за основу страницу /terms с веб-версии и согласуйте финальный вариант с юристом. Черновик для разработки не является офертой.';

export default function TermsScreen() {
  return <LegalWebDocument uri={WEB_TERMS_URL} staticFallback={FALLBACK} />;
}
