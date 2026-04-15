# RENTO — мобильное приложение

P2P-аренда жилья в Ташкенте. Клиент: **Expo (React Native)** + **Supabase** (Auth, Postgres, Storage, Realtime).

## Быстрый старт

```bash
cp .env.example .env
# заполните EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
```

Схема БД и RLS: `supabase_schema.sql`.

## Структура

- `app/` — экраны и навигация (expo-router): вкладки «Лента», «Карта», «Избранное», «Чаты», «Профиль», стек входа/регистрации, черновики «Правила» / «Персональные данные».
- `core/` — конфиг, Supabase-клиент (сессия в SecureStore с разбиением на чанки), контекст авторизации и проверка `is_blocked`, типы таблиц.

## Сборки для сторов

Используйте [EAS Build](https://docs.expo.dev/build/introduction/): задайте `bundleIdentifier` / `package`, иконки и splash в `app.json`, секреты через EAS.
