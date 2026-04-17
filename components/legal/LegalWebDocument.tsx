import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  uri: string;
  /** Текст, если WebView не открылся (сеть, блокировщик, ошибка сервера). */
  staticFallback: string;
};

export function LegalWebDocument({ uri, staticFallback }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const openBrowser = useCallback(() => {
    void Linking.openURL(uri);
  }, [uri]);

  if (failed) {
    return (
      <ScrollView contentContainerStyle={styles.fallbackBody}>
        <Text style={styles.fallbackP}>{staticFallback}</Text>
        <Text style={styles.fallbackNote}>
          Не удалось показать страницу внутри приложения. Откройте актуальную версию в браузере.
        </Text>
        <Pressable style={styles.browserBtn} onPress={openBrowser}>
          <Text style={styles.browserBtnText}>Открыть в браузере</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.disclaimer}>
        Ниже — страница с сайта RENTO. Перед публикацией в сторах сверьте текст с юристом и с
        консолью App Store / Google Play (Data safety).
      </Text>
      {!loaded ? (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}
      <WebView
        style={styles.web}
        source={{ uri }}
        onLoadEnd={() => setLoaded(true)}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  disclaimer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  web: { flex: 1 },
  spinnerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  fallbackBody: { padding: 20, paddingBottom: 40 },
  fallbackP: { fontSize: 16, lineHeight: 24, color: '#333' },
  fallbackNote: { marginTop: 20, fontSize: 14, lineHeight: 22, color: '#92400e' },
  browserBtn: {
    marginTop: 24,
    alignSelf: 'flex-start',
    backgroundColor: '#0d9488',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  browserBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
