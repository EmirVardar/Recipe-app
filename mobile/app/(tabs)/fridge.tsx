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
import { Ionicons } from '@expo/vector-icons';

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
      void searchFoodProducts(normalizedQuery, 5)
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
          <Text style={styles.loggedOutTitle}>Buzdolabını kullanmak için giriş yap</Text>
          <Text style={styles.loggedOutBody}>
            Ürünlerini saklayıp hangi malzemelerin sende olduğunu tek ekranda takip edebilirsin.
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
        <View style={styles.header}>
          <Text style={styles.heroEyebrow}>Mutfak Stoğu</Text>
          <Text style={styles.heroTitle}>Buzdolabım</Text>
          <Text style={styles.heroBody}>
            Veritabanındaki ürünleri arayıp sana ait buzdolabına ekleyebilirsin. Miktarları sonradan artırıp
            azaltmak da mümkün.
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Toplam Ürün</Text>
            <Text style={styles.metricValue}>{formatNumber(totalItems)}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tahmini Kalori</Text>
            <Text style={styles.metricValue}>{formatNumber(totalCalories, ' kcal')}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ürün Ara ve Ekle</Text>

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

          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Ürün ara: yumurta, domates, yoğurt..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
          </View>

          {searchLoading ? <Text style={styles.inlineHint}>Ürünler aranıyor...</Text> : null}
          {!searchLoading && searchQuery.trim().length > 0 && searchQuery.trim().length < 2 ? (
            <Text style={styles.inlineHint}>Arama için en az 2 karakter gir.</Text>
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
          <Text style={styles.sectionTitle}>Buzdolabım</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#F97316" />
            </View>
          ) : null}

          {!loading && items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Henüz ürün eklenmedi</Text>
              <Text style={styles.emptyBody}>Yukarıdan arama yapıp ilk malzemeni buzdolabına ekleyebilirsin.</Text>
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
                    Hızlı düzenle ({item.unitType === 'PIECE' ? '1 tane' : '25 g'})
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
    backgroundColor: '#F5F5F7',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
    alignItems: 'center',
  },
  heroEyebrow: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#111111',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  heroBody: {
    color: '#6E6E73',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
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
    borderColor: '#E8E8ED',
    gap: 6,
  },
  metricLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: '#111111',
    fontSize: 21,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    gap: 12,
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  quantityInput: {
    width: 88,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#111111',
    fontSize: 14,
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
    borderColor: '#E5E5EA',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  unitButtonActive: {
    borderColor: '#1C1C1E',
    backgroundColor: '#1C1C1E',
  },
  unitButtonText: {
    color: '#6E6E73',
    fontSize: 12,
    fontWeight: '700',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  searchInputWrap: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#111111',
    fontSize: 14,
  },
  inlineHint: {
    color: '#8E8E93',
    fontSize: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  productCard: {
    borderWidth: 1,
    borderColor: '#E8E8ED',
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
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  productMeta: {
    color: '#6E6E73',
    fontSize: 12,
    lineHeight: 18,
  },
  productSubMeta: {
    color: '#8E8E93',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
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
    borderColor: '#E8E8ED',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBody: {
    color: '#6E6E73',
    fontSize: 13,
    lineHeight: 19,
  },
  fridgeCard: {
    borderWidth: 1,
    borderColor: '#E8E8ED',
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
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  deleteButtonText: {
    color: '#3A3A3C',
    fontSize: 12,
    fontWeight: '700',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adjustButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    color: '#1C1C1E',
    fontSize: 17,
    fontWeight: '700',
  },
  adjustLabel: {
    flex: 1,
    color: '#6E6E73',
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
    color: '#111111',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  loggedOutBody: {
    color: '#6E6E73',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
