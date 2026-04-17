import { Stack } from 'expo-router';

export default function MyListingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Мои объявления' }} />
      <Stack.Screen name="new" options={{ title: 'Новое объявление' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Редактирование' }} />
    </Stack>
  );
}
