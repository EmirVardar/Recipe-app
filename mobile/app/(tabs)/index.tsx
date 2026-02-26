import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getApiBaseUrl, pingBackend } from '@/lib/api';

type PingState = {
  status: string;
  service: string;
  timestamp: string;
} | null;

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ping, setPing] = useState<PingState>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await pingBackend();
        setPing(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Backend Connection Test</ThemedText>
      <ThemedText type="defaultSemiBold">Base URL: {getApiBaseUrl()}</ThemedText>

      {loading ? <ThemedText>Checking backend...</ThemedText> : null}

      {error ? <ThemedText style={styles.error}>Error: {error}</ThemedText> : null}

      {ping ? (
        <ThemedView style={styles.card}>
          <ThemedText>Status: {ping.status}</ThemedText>
          <ThemedText>Service: {ping.service}</ThemedText>
          <ThemedText>Time: {ping.timestamp}</ThemedText>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    gap: 14,
  },
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    padding: 14,
  },
  error: {
    color: '#b42318',
  },
});
