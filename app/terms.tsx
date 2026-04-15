import { ScrollView, StyleSheet, Text } from 'react-native';

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.p}>
        Здесь будет полный текст правил площадки RENTO. Возьмите за основу страницу /terms с
        веб-версии и согласуйте финальный вариант с юристом.
      </Text>
      <Text style={styles.note}>
        Черновик для разработки. Не является офертой и не заменяет юридическую экспертизу.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  p: { fontSize: 16, lineHeight: 24, color: '#333' },
  note: { marginTop: 24, fontSize: 14, lineHeight: 22, color: '#92400e' },
});
