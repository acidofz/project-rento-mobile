import { ScrollView, StyleSheet, Text } from 'react-native';

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.p}>
        Здесь будет политика персональных данных: какие данные собираем (аккаунт, объявления,
        переписка, фото), зачем, как храним (в том числе через Supabase), сроки и права
        пользователя. Основа — страница /privacy на сайте; финальный текст — с юристом.
      </Text>
      <Text style={styles.note}>
        Черновик для разработки. Уточните формулировки перед публикацией в сторах.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  p: { fontSize: 16, lineHeight: 24, color: '#333' },
  note: { marginTop: 24, fontSize: 14, lineHeight: 22, color: '#92400e' },
});
