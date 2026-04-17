import { Redirect, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ListingForm } from '@/components/listings/ListingForm';
import { useAuth } from '@/core/auth/AuthContext';

export default function NewListingScreen() {
  const router = useRouter();
  const { session, canCreateContent } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!canCreateContent) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <View style={styles.root}>
      <ListingForm mode="create" onSuccess={() => router.replace('/my-listings' as Href)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
});
