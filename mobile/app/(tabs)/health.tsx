import { router } from 'expo-router';
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
import HealthKit from '@kingstinct/react-native-healthkit';
import {
  addRecipeMealItem,
  addMealItem,
  deleteMealItem,
  getDailyMeals,
  getHealthTransferRecords,
  searchFoodProducts,
  searchRecipes,
  sendHealthData,
  updateMealItem,
  updateRecipeMealItem,
  type DailyMealLogsResponse,
  type FoodProductSearchItemResponse,
  type HealthTransferResponse,
  type MealLogItemResponse,
  type RecipeListItemResponse,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

const MEAL_TYPES = [
  { key: 'BREAKFAST', label: 'Kahvalti' },
  { key: 'LUNCH', label: 'Ogle' },
  { key: 'DINNER', label: 'Aksam' },
  { key: 'SNACK', label: 'Ara Ogun' },
] as const;

const UNIT_TYPES = [
  { key: 'GRAM', label: 'Gram' },
  { key: 'PIECE', label: 'Tane' },
] as const;

const SEARCH_TYPES = [
  { key: 'FOOD', label: 'Urun' },
  { key: 'RECIPE', label: 'Recipe' },
] as const;

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

function getMealLabel(mealType: string) {
  return MEAL_TYPES.find((item) => item.key === mealType)?.label ?? mealType;
}

function getUnitLabel(unitType: string) {
  return UNIT_TYPES.find((item) => item.key === unitType)?.label ?? unitType;
}

function getMealItemTitle(item: MealLogItemResponse) {
  return item.sourceName ?? item.foodName ?? 'Bilinmeyen oge';
}

function getMealItemAdjustLabel(item: MealLogItemResponse) {
  if (item.sourceType === 'RECIPE') {
    return 'Hizli duzenle (0.5 porsiyon)';
  }

  return `Hizli duzenle (${item.unitType === 'PIECE' ? '1 tane' : '25 g'})`;
}

export default function ShoppingListTabScreen() {
  const { accessToken, isLoggedIn } = useAuth();

  const [records, setRecords] = useState<HealthTransferResponse[]>([]);
  const [dailyMeals, setDailyMeals] = useState<DailyMealLogsResponse | null>(null);
  const [foodResults, setFoodResults] = useState<FoodProductSearchItemResponse[]>([]);
  const [recipeResults, setRecipeResults] = useState<RecipeListItemResponse[]>([]);
  const [searchType, setSearchType] = useState<(typeof SEARCH_TYPES)[number]['key']>('FOOD');
  const [foodQuery, setFoodQuery] = useState('');
  const [recipeQuery, setRecipeQuery] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<(typeof MEAL_TYPES)[number]['key']>('BREAKFAST');
  const [selectedUnitType, setSelectedUnitType] = useState<(typeof UNIT_TYPES)[number]['key']>('GRAM');
  const [foodQuantityInput, setFoodQuantityInput] = useState('100');
  const [recipeServingsInput, setRecipeServingsInput] = useState('1');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [recipeSearchLoading, setRecipeSearchLoading] = useState(false);
  const [submittingItemId, setSubmittingItemId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncingHealth, setSyncingHealth] = useState(false);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const nextRecordsPromise = getHealthTransferRecords();
        const nextMealsPromise = accessToken ? getDailyMeals(accessToken) : Promise.resolve(null);
        const [nextRecords, nextMeals] = await Promise.all([nextRecordsPromise, nextMealsPromise]);

        setRecords(nextRecords);
        setDailyMeals(nextMeals);
        setErrorMessage('');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Veriler yuklenemedi.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

  const syncHealthData = useCallback(async () => {
    setSyncingHealth(true);

    try {
      const isAvailable = await HealthKit.isHealthDataAvailable();
      if (!isAvailable) {
        setErrorMessage('HealthKit bu cihazda kullanılamıyor.');
        setSyncingHealth(false);
        return;
      }

      await HealthKit.requestAuthorization({
        toRead: ['HKQuantityTypeIdentifierStepCount', 'HKQuantityTypeIdentifierActiveEnergyBurned'],
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const [stepStatistics, calorieStatistics] = await Promise.all([
        HealthKit.queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierStepCount',
          ['cumulativeSum'],
          {
            unit: 'count',
            filter: {
              date: {
                startDate: today,
                endDate: now,
              },
            },
          }
        ),
        HealthKit.queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          ['cumulativeSum'],
          {
            unit: 'kcal',
            filter: {
              date: {
                startDate: today,
                endDate: now,
              },
            },
          }
        ),
      ]);

      const adim = Math.round(stepStatistics.sumQuantity?.quantity ?? 0);
      const kalori = Math.round(calorieStatistics.sumQuantity?.quantity ?? 0);

      await sendHealthData({ adim, kalori, date: dateStr });
      await loadDashboard();
      setErrorMessage('');
    } catch (e) {
      console.log(
        'HealthKit error:',
        e,
        e instanceof Error ? e.message : 'unknown',
        JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}))
      );
      setErrorMessage('HealthKit baglantisi kurulamadi.');
    } finally {
      setSyncingHealth(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const normalizedQuery = foodQuery.trim();
    if (!isLoggedIn || normalizedQuery.length < 2) {
      setFoodResults([]);
      setFoodSearchLoading(false);
      return;
    }

    setFoodSearchLoading(true);
    const timeoutId = setTimeout(() => {
      void searchFoodProducts(normalizedQuery, 10)
        .then((results) => {
          setFoodResults(results);
          setErrorMessage('');
        })
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : 'Urun arama basarisiz oldu.');
        })
        .finally(() => {
          setFoodSearchLoading(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [foodQuery, isLoggedIn]);

  useEffect(() => {
    const normalizedQuery = recipeQuery.trim();
    if (!isLoggedIn || !accessToken || normalizedQuery.length < 2) {
      setRecipeResults([]);
      setRecipeSearchLoading(false);
      return;
    }

    setRecipeSearchLoading(true);
    const timeoutId = setTimeout(() => {
      void searchRecipes(accessToken, normalizedQuery)
        .then((results) => {
          setRecipeResults(results);
          setErrorMessage('');
        })
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : 'Recipe arama basarisiz oldu.');
        })
        .finally(() => {
          setRecipeSearchLoading(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [accessToken, isLoggedIn, recipeQuery]);

  const latestRecord = records[0] ?? null;

  const dailyLatestRecords = useMemo(() => {
    const latestByDay = new Map<string, HealthTransferResponse>();

    for (const record of records) {
      const dayKey = getDayKey(record.date);
      if (!latestByDay.has(dayKey)) {
        latestByDay.set(dayKey, record);
      }
    }

    return Array.from(latestByDay.values());
  }, [records]);

  const todayKey = getDayKey(new Date().toISOString());

  const todayRecord = useMemo(
    () => dailyLatestRecords.find((record) => getDayKey(record.date) === todayKey) ?? latestRecord,
    [dailyLatestRecords, latestRecord, todayKey]
  );

  const totalHealthCalories = useMemo(
    () => dailyLatestRecords.reduce((sum, item) => sum + item.kalori, 0),
    [dailyLatestRecords]
  );

  const totalSteps = useMemo(
    () => dailyLatestRecords.reduce((sum, item) => sum + item.adim, 0),
    [dailyLatestRecords]
  );


  const parsedFoodQuantity = Number(foodQuantityInput.replace(',', '.'));
  const parsedRecipeServings = Number(recipeServingsInput.replace(',', '.'));
  const foodQuantityValid = Number.isFinite(parsedFoodQuantity) && parsedFoodQuantity > 0;
  const recipeServingsValid = Number.isFinite(parsedRecipeServings) && parsedRecipeServings > 0;

  const handleAddFood = async (product: FoodProductSearchItemResponse) => {
    if (!accessToken || !foodQuantityValid || submittingItemId != null) {
      return;
    }

    setSubmittingItemId(product.id);

    try {
      await addMealItem(accessToken, {
        mealType: selectedMealType,
        foodProductId: product.id,
        quantity: parsedFoodQuantity,
        unitType: selectedUnitType,
      });

      setFoodQuery('');
      setFoodResults([]);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Urun ogune eklenemedi.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  const handleAddRecipe = async (recipe: RecipeListItemResponse) => {
    if (!accessToken || !recipeServingsValid || submittingItemId != null) {
      return;
    }

    setSubmittingItemId(recipe.id);

    try {
      await addRecipeMealItem(accessToken, {
        mealType: selectedMealType,
        recipeId: recipe.id,
        servings: parsedRecipeServings,
      });

      setRecipeQuery('');
      setRecipeResults([]);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Recipe ogune eklenemedi.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  const handleUpdateItem = async (mealType: string, item: MealLogItemResponse, direction: 'increase' | 'decrease') => {
    if (!accessToken || submittingItemId != null) {
      return;
    }

    const step = item.sourceType === 'RECIPE' ? 0.5 : item.unitType === 'PIECE' ? 1 : 25;
    const nextQuantity = direction === 'increase' ? item.quantity + step : item.quantity - step;

    if (nextQuantity <= 0) {
      return;
    }

    setSubmittingItemId(item.id);

    try {
      if (item.sourceType === 'RECIPE') {
        if (item.sourceId == null) {
          throw new Error('Recipe bilgisi eksik.');
        }

        await updateRecipeMealItem(accessToken, item.id, {
          mealType,
          recipeId: item.sourceId,
          servings: nextQuantity,
        });
      } else {
        if (item.foodProductId == null) {
          throw new Error('Urun bilgisi eksik.');
        }

        await updateMealItem(accessToken, item.id, {
          mealType,
          foodProductId: item.foodProductId,
          quantity: nextQuantity,
          unitType: item.unitType,
        });
      }

      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Ogun guncellenemedi.');
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
      await deleteMealItem(accessToken, itemId);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Ogun ogesi silinemedi.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} />}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ReciPulse Health</Text>
          <Text style={styles.title}>Saglik ve Ogun Takibi</Text>
          <Text style={styles.subtitle}>
            Gunluk ogunlerini urun ve recipe bazli ekle, makrolari otomatik hesapla ve saglik verilerinle ayni ekranda takip et.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>Veriler yukleniyor...</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Baglanti Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {!loading && !isLoggedIn ? (
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Ogun takibi icin giris yap</Text>
            <Text style={styles.authBody}>
              Urun arama, ogune ekleme ve kullaniciya ozel kayitlari gorebilmek icin once profil ekranindan giris yapman gerekiyor.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.primaryButtonText}>Profili Ac</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && isLoggedIn ? (
          <>
            <View style={styles.mealComposerCard}>
              <Text style={styles.sectionTitle}>Ogun Ekle</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {MEAL_TYPES.map((mealType) => {
                  const active = selectedMealType === mealType.key;

                  return (
                    <Pressable
                      key={mealType.key}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      onPress={() => setSelectedMealType(mealType.key)}>
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{mealType.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.modeSwitch}>
                {SEARCH_TYPES.map((item) => {
                  const active = searchType === item.key;

                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.modeButton, active ? styles.modeButtonActive : null]}
                      onPress={() => setSearchType(item.key)}>
                      <Text style={[styles.modeButtonText, active ? styles.modeButtonTextActive : null]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.controlsRow}>
                <TextInput
                  value={searchType === 'FOOD' ? foodQuantityInput : recipeServingsInput}
                  onChangeText={searchType === 'FOOD' ? setFoodQuantityInput : setRecipeServingsInput}
                  keyboardType="decimal-pad"
                  placeholder={searchType === 'FOOD' ? (selectedUnitType === 'GRAM' ? '100' : '2') : '1'}
                  placeholderTextColor="#94A3B8"
                  style={styles.quantityInput}
                />

                {searchType === 'FOOD' ? (
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
                ) : (
                  <View style={styles.recipeServingBadge}>
                    <Text style={styles.recipeServingBadgeText}>Porsiyon</Text>
                  </View>
                )}
              </View>

              <TextInput
                value={searchType === 'FOOD' ? foodQuery : recipeQuery}
                onChangeText={searchType === 'FOOD' ? setFoodQuery : setRecipeQuery}
                placeholder={
                  searchType === 'FOOD'
                    ? 'Urun ara: egg, boiled egg, fried potato...'
                    : 'Recipe ara: pasta, chicken salad, soup...'
                }
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />

              {searchType === 'FOOD' && foodSearchLoading ? (
                <Text style={styles.inlineHint}>Urunler aranıyor...</Text>
              ) : null}

              {searchType === 'RECIPE' && recipeSearchLoading ? (
                <Text style={styles.inlineHint}>Recipe arama suruyor...</Text>
              ) : null}

              {searchType === 'FOOD' && foodQuery.trim().length < 2 ? (
                <Text style={styles.inlineHint}>Arama icin en az 2 karakter gir.</Text>
              ) : null}

              {searchType === 'RECIPE' && recipeQuery.trim().length < 2 ? (
                <Text style={styles.inlineHint}>Recipe aramak icin en az 2 karakter gir.</Text>
              ) : null}

              {searchType === 'FOOD' &&
                foodResults.map((product) => (
                  <View key={product.id} style={styles.foodCard}>
                    <View style={styles.foodCardTop}>
                      <View style={styles.foodCardTextWrap}>
                        <Text style={styles.foodName}>{product.name}</Text>
                        <Text style={styles.foodMeta}>
                          {formatNumber(product.caloriesPer100g, ' kcal')} • P{' '}
                          {formatNumber(product.proteinPer100g)} • C {formatNumber(product.carbsPer100g)} • Y{' '}
                          {formatNumber(product.fatPer100g)}
                        </Text>
                      </View>

                      <Pressable
                        style={[styles.primaryButtonSmall, !foodQuantityValid ? styles.primaryButtonDisabled : null]}
                        onPress={() => void handleAddFood(product)}
                        disabled={!foodQuantityValid || submittingItemId === product.id}>
                        <Text style={styles.primaryButtonText}>
                          {submittingItemId === product.id ? '...' : 'Ekle'}
                        </Text>
                      </Pressable>
                    </View>

                    {selectedUnitType === 'PIECE' && product.pieceGramWeight ? (
                      <Text style={styles.foodSubMeta}>1 tane: {formatNumber(product.pieceGramWeight, ' g')}</Text>
                    ) : null}
                  </View>
                ))}

              {searchType === 'RECIPE' &&
                recipeResults.map((recipe) => (
                  <View key={recipe.id} style={styles.foodCard}>
                    <View style={styles.foodCardTop}>
                      <View style={styles.foodCardTextWrap}>
                        <Text style={styles.foodName}>{recipe.title}</Text>
                        <Text style={styles.foodMeta}>
                          {formatNumber(recipe.calories, ' kcal')} • {recipe.primaryCategory} •{' '}
                          {recipe.servings ? `${formatNumber(recipe.servings)} porsiyon` : 'Porsiyon bilgisi yok'}
                        </Text>
                      </View>

                      <Pressable
                        style={[styles.primaryButtonSmall, !recipeServingsValid ? styles.primaryButtonDisabled : null]}
                        onPress={() => void handleAddRecipe(recipe)}
                        disabled={!recipeServingsValid || submittingItemId === recipe.id}>
                        <Text style={styles.primaryButtonText}>
                          {submittingItemId === recipe.id ? '...' : 'Ekle'}
                        </Text>
                      </Pressable>
                    </View>

                    <Text style={styles.foodSubMeta}>
                      Hazirlama: {recipe.readyInMinutes ? `${recipe.readyInMinutes} dk` : 'Bilinmiyor'}
                    </Text>
                  </View>
                ))}
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Bugun Yenilen</Text>
                <Text style={styles.metricValue}>{formatNumber(dailyMeals?.totalCalories, ' kcal')}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Protein</Text>
                <Text style={styles.metricValue}>{formatNumber(dailyMeals?.totalProtein, ' g')}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Karbonhidrat</Text>
                <Text style={styles.metricValue}>{formatNumber(dailyMeals?.totalCarbs, ' g')}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Yag</Text>
                <Text style={styles.metricValue}>{formatNumber(dailyMeals?.totalFat, ' g')}</Text>
              </View>
            </View>

            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Bugunun Ogunleri</Text>

              {dailyMeals?.meals?.length ? (
                dailyMeals.meals.map((meal) => (
                  <View key={meal.id} style={styles.recordCard}>
                    <View style={styles.dailyHeader}>
                      <Text style={styles.dailyTitle}>{getMealLabel(meal.mealType)}</Text>
                      <Text style={styles.dailyBadge}>{formatNumber(meal.totalCalories, ' kcal')}</Text>
                    </View>

                    <View style={styles.macroRow}>
                      <Text style={styles.recordLabel}>P {formatNumber(meal.totalProtein, ' g')}</Text>
                      <Text style={styles.recordLabel}>C {formatNumber(meal.totalCarbs, ' g')}</Text>
                      <Text style={styles.recordLabel}>Y {formatNumber(meal.totalFat, ' g')}</Text>
                    </View>

                    {meal.items.map((item) => (
                      <View key={item.id} style={styles.mealItemCard}>
                        <View style={styles.mealItemHeader}>
                          <View style={styles.mealItemTextWrap}>
                            <Text style={styles.mealItemTitle}>{getMealItemTitle(item)}</Text>
                            <Text style={styles.mealItemMeta}>
                              {item.sourceType === 'RECIPE'
                                ? `${formatNumber(item.quantity)} porsiyon • ${formatNumber(item.calories, ' kcal')}`
                                : `${formatNumber(item.quantity)} ${getUnitLabel(item.unitType).toLowerCase()} • ${formatNumber(
                                    item.gramEquivalent,
                                    ' g'
                                  )} • ${formatNumber(item.calories, ' kcal')}`}
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
                            onPress={() => void handleUpdateItem(meal.mealType, item, 'decrease')}
                            disabled={submittingItemId === item.id}>
                            <Text style={styles.adjustButtonText}>-</Text>
                          </Pressable>

                          <Text style={styles.adjustLabel}>{getMealItemAdjustLabel(item)}</Text>

                          <Pressable
                            style={styles.adjustButton}
                            onPress={() => void handleUpdateItem(meal.mealType, item, 'increase')}
                            disabled={submittingItemId === item.id}>
                            <Text style={styles.adjustButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Bugun henuz ogun eklenmedi</Text>
                  <Text style={styles.emptyBody}>
                    Yukardan bir urun ya da recipe arayip kahvalti, ogle, aksam ya da ara ogune ekleyebilirsin.
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : null}

        {!loading ? (
          <>
            <Pressable
              style={[styles.primaryButton, syncingHealth ? styles.primaryButtonDisabled : null]}
              onPress={() => void syncHealthData()}
              disabled={syncingHealth}>
              <Text style={styles.primaryButtonText}>
                {syncingHealth ? 'Senkronize ediliyor...' : 'Apple Health Senkronize Et'}
              </Text>
            </Pressable>

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
                <Text style={styles.metricValue}>{formatNumber(totalHealthCalories, ' kcal')}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Gunluk Adim Toplami</Text>
                <Text style={styles.metricValue}>{formatNumber(totalSteps)}</Text>
              </View>
            </View>

            {latestRecord ? (
              <View style={styles.highlightCard}>
                <Text style={styles.highlightEyebrow}>Son Senkron</Text>
                <Text style={styles.highlightTitle}>{formatDateLabel(latestRecord.date)}</Text>
                <Text style={styles.highlightBody}>
                  En son gelen veri {formatNumber(latestRecord.adim)} adim ve{' '}
                  {formatNumber(latestRecord.kalori, ' kcal')}. Gunluk hesaplarda ayni gunden sadece en yeni kayit
                  kullaniliyor.
                </Text>
              </View>
            ) : null}

            {dailyLatestRecords.length > 0 ? (
              <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>Gunluk Ozet</Text>

                {dailyLatestRecords.map((record) => (
                  <View key={`daily-${record.id}`} style={styles.recordCard}>
                    <View style={styles.dailyHeader}>
                      <Text style={styles.dailyTitle}>{formatDayLabel(record.date)}</Text>
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

                    <Text style={styles.recordDate}>Son guncelleme: {formatDateLabel(record.date)}</Text>
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
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  authTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  authBody: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
  },
  mealComposerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  chipRow: {
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  chipActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  chipText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#EA580C',
  },
  modeButtonText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  quantityInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  unitSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    gap: 4,
  },
  recipeServingBadge: {
    minWidth: 108,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  recipeServingBadgeText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  unitButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unitButtonActive: {
    backgroundColor: '#111827',
  },
  unitButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 15,
  },
  inlineHint: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  foodCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  foodCardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  foodCardTextWrap: {
    flex: 1,
    gap: 4,
  },
  foodName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  foodMeta: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  foodSubMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EA580C',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryButtonSmall: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
  historySection: {
    gap: 12,
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
    flex: 1,
  },
  dailyBadge: {
    color: '#9A3412',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  mealItemCard: {
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  mealItemHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  mealItemTextWrap: {
    flex: 1,
    gap: 4,
  },
  mealItemTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  mealItemMeta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  deleteButton: {
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  deleteButtonText: {
    color: '#BE123C',
    fontSize: 12,
    fontWeight: '800',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  adjustLabel: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
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
