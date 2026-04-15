import { StyleSheet, Text, View } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Карта</Text>
      <Text style={styles.hint}>Точки объявлений с координатами появятся здесь.</Text>
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
