import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addFridgeItem,
  deleteFridgeItem,
  getFridgeItems,
  searchFoodProducts,
  updateFridgeItem,
  type FoodProductSearchItemResponse,
  type FridgeItemResponse,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

const UNIT_TYPES = [
  { key: 'GRAM', label: 'Gram' },
  { key: 'PIECE', label: 'Tane' },
] as const;

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value == null) {
    return '-';
  }

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${suffix}`;
}

export default function FridgeTabScreen() {
  const { accessToken, isLoggedIn } = useAuth();
  const [items, setItems] = useState<FridgeItemResponse[]>([]);
  const [searchResults, setSearchResults] = useState<FoodProductSearchItemResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnitType, setSelectedUnitType] = useState<(typeof UNIT_TYPES)[number]['key']>('GRAM');
  const [quantityInput, setQuantityInput] = useState('100');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submittingItemId, setSubmittingItemId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const parsedQuantity = Number(quantityInput.replace(',', '.'));
  const quantityValid = Number.isFinite(parsedQuantity) && parsedQuantity > 0;

  const loadItems = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const nextItems = await getFridgeItems(accessToken);
        setItems(nextItems);
        setErrorMessage('');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Buzdolabi yuklenemedi.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();

    if (!isLoggedIn || normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timeoutId = setTimeout(() => {
      void searchFoodProducts(normalizedQuery, 10)
        .then((results) => {
          setSearchResults(results);
          setErrorMessage('');
        })
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : 'Urun arama basarisiz oldu.');
        })
        .finally(() => {
          setSearchLoading(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isLoggedIn, searchQuery]);

  const totalCalories = useMemo(() => items.reduce((sum, item) => sum + item.calories, 0), [items]);
  const totalItems = items.length;

  const handleAddItem = async (product: FoodProductSearchItemResponse) => {
    if (!accessToken || !quantityValid || submittingItemId != null) {
      return;
    }

    setSubmittingItemId(product.id);

    try {
      await addFridgeItem(accessToken, {
        foodProductId: product.id,
        quantity: parsedQuantity,
        unitType: selectedUnitType,
      });

      setSearchQuery('');
      setSearchResults([]);
      await loadItems();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Urun buzdolabina eklenemedi.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  const handleAdjustItem = async (item: FridgeItemResponse, direction: 'increase' | 'decrease') => {
    if (!accessToken || submittingItemId != null) {
      return;
    }

    const step = item.unitType === 'PIECE' ? 1 : 25;
    const nextQuantity = direction === 'increase' ? item.quantity + step : item.quantity - step;

    if (nextQuantity <= 0) {
      return;
    }

    setSubmittingItemId(item.id);

    try {
      await updateFridgeItem(accessToken, item.id, {
        foodProductId: item.foodProductId,
        quantity: nextQuantity,
        unitType: item.unitType,
      });
      await loadItems();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Urun guncellenemedi.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!accessToken || submittingItemId != null) {
      return;
    }

    setSubmittingItemId(itemId);

    try {
      await deleteFridgeItem(accessToken, itemId);
      await loadItems();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Urun silinemedi.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loggedOutState}>
          <Text style={styles.loggedOutTitle}>Buzdolabini kullanmak icin giris yap</Text>
          <Text style={styles.loggedOutBody}>
            Urunlerini saklayip hangi malzemelerin sende oldugunu tek ekranda takip edebilirsin.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadItems(true)} />}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Mutfak Stogu</Text>
          <Text style={styles.heroTitle}>Buzdolabindaki urunleri hizlica yonet</Text>
          <Text style={styles.heroBody}>
            Veritabanindaki urunleri arayip sana ait buzdolabina ekleyebilirsin. Miktarlari sonradan artirip
            azaltmak da mumkun.
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Toplam Urun</Text>
            <Text style={styles.metricValue}>{formatNumber(totalItems)}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tahmini Kalori</Text>
            <Text style={styles.metricValue}>{formatNumber(totalCalories, ' kcal')}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Urun Ara ve Ekle</Text>

          <View style={styles.controlsRow}>
            <TextInput
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="decimal-pad"
              placeholder={selectedUnitType === 'GRAM' ? '100' : '2'}
              placeholderTextColor="#94A3B8"
              style={styles.quantityInput}
            />

            <View style={styles.unitSwitch}>
              {UNIT_TYPES.map((unitType) => {
                const active = selectedUnitType === unitType.key;

                return (
                  <Pressable
                    key={unitType.key}
                    style={[styles.unitButton, active ? styles.unitButtonActive : null]}
                    onPress={() => setSelectedUnitType(unitType.key)}>
                    <Text style={[styles.unitButtonText, active ? styles.unitButtonTextActive : null]}>
                      {unitType.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Urun ara: egg, tomato, yogurt..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />

          {searchLoading ? <Text style={styles.inlineHint}>Urunler aranıyor...</Text> : null}
          {!searchLoading && searchQuery.trim().length > 0 && searchQuery.trim().length < 2 ? (
            <Text style={styles.inlineHint}>Arama icin en az 2 karakter gir.</Text>
          ) : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {searchResults.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productTextWrap}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productMeta}>
                  {formatNumber(product.caloriesPer100g, ' kcal')} • P {formatNumber(product.proteinPer100g)} • C{' '}
                  {formatNumber(product.carbsPer100g)} • Y {formatNumber(product.fatPer100g)}
                </Text>
                {selectedUnitType === 'PIECE' && product.pieceGramWeight ? (
                  <Text style={styles.productSubMeta}>1 tane: {formatNumber(product.pieceGramWeight, ' g')}</Text>
                ) : null}
              </View>

              <Pressable
                style={[styles.addButton, !quantityValid ? styles.buttonDisabled : null]}
                onPress={() => void handleAddItem(product)}
                disabled={!quantityValid || submittingItemId === product.id}>
                <Text style={styles.addButtonText}>{submittingItemId === product.id ? '...' : 'Ekle'}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Buzdolabim</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#F97316" />
            </View>
          ) : null}

          {!loading && items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Henuz urun eklenmedi</Text>
              <Text style={styles.emptyBody}>Yukardan arama yapip ilk malzemeni buzdolabina ekleyebilirsin.</Text>
            </View>
          ) : null}

          {!loading &&
            items.map((item) => (
              <View key={item.id} style={styles.fridgeCard}>
                <View style={styles.fridgeCardTop}>
                  <View style={styles.productTextWrap}>
                    <Text style={styles.productName}>{item.foodName}</Text>
                    <Text style={styles.productMeta}>
                      {formatNumber(item.quantity)} {item.unitType === 'PIECE' ? 'tane' : 'g'} •{' '}
                      {formatNumber(item.gramEquivalent, ' g')} • {formatNumber(item.calories, ' kcal')}
                    </Text>
                    <Text style={styles.productSubMeta}>
                      P {formatNumber(item.protein, ' g')} • C {formatNumber(item.carbs, ' g')} • Y{' '}
                      {formatNumber(item.fat, ' g')}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => void handleDeleteItem(item.id)}
                    disabled={submittingItemId === item.id}>
                    <Text style={styles.deleteButtonText}>{submittingItemId === item.id ? '...' : 'Sil'}</Text>
                  </Pressable>
                </View>

                <View style={styles.adjustRow}>
                  <Pressable
                    style={styles.adjustButton}
                    onPress={() => void handleAdjustItem(item, 'decrease')}
                    disabled={submittingItemId === item.id}>
                    <Text style={styles.adjustButtonText}>-</Text>
                  </Pressable>

                  <Text style={styles.adjustLabel}>
                    Hizli duzenle ({item.unitType === 'PIECE' ? '1 tane' : '25 g'})
                  </Text>

                  <Pressable
                    style={styles.adjustButton}
                    onPress={() => void handleAdjustItem(item, 'increase')}
                    disabled={submittingItemId === item.id}>
                    <Text style={styles.adjustButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </View>
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
  heroCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 8,
  },
  heroEyebrow: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  heroBody: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 21,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  metricLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  quantityInput: {
    width: 88,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  unitSwitch: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  unitButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  unitButtonActive: {
    borderColor: '#F97316',
    backgroundColor: '#FFF1E6',
  },
  unitButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  unitButtonTextActive: {
    color: '#C2410C',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    color: '#111827',
    fontSize: 14,
  },
  inlineHint: {
    color: '#64748B',
    fontSize: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  productCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  productTextWrap: {
    flex: 1,
    gap: 4,
  },
  productName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  productMeta: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 18,
  },
  productSubMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  loadingState: {
    paddingVertical: 18,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBody: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  fridgeCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  fridgeCardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  deleteButton: {
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adjustButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    color: '#C2410C',
    fontSize: 18,
    fontWeight: '800',
  },
  adjustLabel: {
    flex: 1,
    color: '#4B5563',
    fontSize: 12,
  },
  loggedOutState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  loggedOutTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  loggedOutBody: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
