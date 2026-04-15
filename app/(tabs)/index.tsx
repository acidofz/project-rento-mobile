import { StyleSheet, Text, View } from 'react-native';

export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Объявления</Text>
      <Text style={styles.hint}>Здесь будет лента с поиском и фильтрами.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 16, color: '#555', lineHeight: 24 },
});
