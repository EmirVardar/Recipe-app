import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHealthTransferRecords, type HealthTransferResponse } from '@/lib/api';

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value == null) {
    return '-';
  }

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${suffix}`;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDayKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    weekday: 'short',
  });
}

export default function ShoppingListTabScreen() {
  const [records, setRecords] = useState<HealthTransferResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadRecords = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const nextRecords = await getHealthTransferRecords();
      setRecords(nextRecords);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Saglik kayitlari yuklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const latestRecord = records[0] ?? null;
  const dailyLatestRecords = useMemo(() => {
    const latestByDay = new Map<string, HealthTransferResponse>();

    for (const record of records) {
      const dayKey = getDayKey(record.createdAt);
      if (!latestByDay.has(dayKey)) {
        latestByDay.set(dayKey, record);
      }
    }

    return Array.from(latestByDay.values());
  }, [records]);
  const todayKey = getDayKey(new Date().toISOString());
  const todayRecord = useMemo(
    () => dailyLatestRecords.find((record) => getDayKey(record.createdAt) === todayKey) ?? latestRecord,
    [dailyLatestRecords, latestRecord, todayKey]
  );
  const totalCalories = useMemo(() => dailyLatestRecords.reduce((sum, item) => sum + item.kalori, 0), [dailyLatestRecords]);
  const totalSteps = useMemo(() => dailyLatestRecords.reduce((sum, item) => sum + item.adim, 0), [dailyLatestRecords]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRecords(true)} />}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ReciPulse Health</Text>
          <Text style={styles.title}>Kalori Sayacim</Text>
          <Text style={styles.subtitle}>
            Ayni gunde gelen birden fazla kayit gunluk toplamda tekrar sayilmaz. Her gun icin sadece son veri esas alinir.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>Saglik kayitlari yukleniyor...</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Baglanti Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {!loading ? (
          <>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Bugun Kalori</Text>
                <Text style={styles.metricValue}>{formatNumber(todayRecord?.kalori, ' kcal')}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Bugun Adim</Text>
                <Text style={styles.metricValue}>{formatNumber(todayRecord?.adim)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Gunluk Kalori Toplami</Text>
                <Text style={styles.metricValue}>{formatNumber(totalCalories, ' kcal')}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Gunluk Adim Toplami</Text>
                <Text style={styles.metricValue}>{formatNumber(totalSteps)}</Text>
              </View>
            </View>

            {latestRecord ? (
              <View style={styles.highlightCard}>
                <Text style={styles.highlightEyebrow}>Son Senkron</Text>
                <Text style={styles.highlightTitle}>{formatDateLabel(latestRecord.createdAt)}</Text>
                <Text style={styles.highlightBody}>
                  En son gelen veri {formatNumber(latestRecord.adim)} adim ve {formatNumber(latestRecord.kalori, ' kcal')}.
                  Gunluk hesaplarda ayni gunden sadece en yeni kayit kullaniliyor.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Henuz kayit yok</Text>
                <Text style={styles.emptyBody}>
                  `/api/saglik/aktar` endpointine veri geldikce burada kalori ve adim sayacini goreceksin.
                </Text>
              </View>
            )}

            {dailyLatestRecords.length > 0 ? (
              <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>Gunluk Ozet</Text>
                {dailyLatestRecords.map((record) => (
                  <View key={`daily-${record.id}`} style={styles.recordCard}>
                    <View style={styles.dailyHeader}>
                      <Text style={styles.dailyTitle}>{formatDayLabel(record.createdAt)}</Text>
                      <Text style={styles.dailyBadge}>Gun sonu degeri</Text>
                    </View>
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Kalori</Text>
                      <Text style={styles.recordValue}>{formatNumber(record.kalori, ' kcal')}</Text>
                    </View>
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Adim</Text>
                      <Text style={styles.recordValue}>{formatNumber(record.adim)}</Text>
                    </View>
                    <Text style={styles.recordDate}>Son guncelleme: {formatDateLabel(record.createdAt)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {records.length > 0 ? (
              <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>Saatlik Gecmis</Text>
                {records.map((record) => (
                  <View key={record.id} style={styles.recordCard}>
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Kalori</Text>
                      <Text style={styles.recordValue}>{formatNumber(record.kalori, ' kcal')}</Text>
                    </View>
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Adim</Text>
                      <Text style={styles.recordValue}>{formatNumber(record.adim)}</Text>
                    </View>
                    <Text style={styles.recordDate}>{formatDateLabel(record.createdAt)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 18,
  },
  header: {
    paddingTop: 8,
    gap: 6,
  },
  eyebrow: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 22,
  },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loaderText: {
    color: '#6B7280',
    fontSize: 15,
  },
  messageCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  messageTitle: {
    color: '#9A3412',
    fontSize: 16,
    fontWeight: '700',
  },
  messageBody: {
    color: '#7C2D12',
    fontSize: 14,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  metricLabel: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#111827',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  highlightCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  highlightEyebrow: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  highlightTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  highlightBody: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 21,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
  },
  historySection: {
    gap: 12,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  dailyTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  dailyBadge: {
    color: '#9A3412',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  recordValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  recordDate: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
});
