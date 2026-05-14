import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
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
  { key: 'BREAKFAST', label: 'Kahvaltı' },
  { key: 'LUNCH', label: 'Öğle' },
  { key: 'DINNER', label: 'Akşam' },
  { key: 'SNACK', label: 'Ara Öğün' },
] as const;

const UNIT_TYPES = [
  { key: 'GRAM', label: 'Gram' },
  { key: 'PIECE', label: 'Tane' },
] as const;

const SEARCH_TYPES = [
  { key: 'FOOD', label: 'Ürün' },
  { key: 'RECIPE', label: 'Tarif' },
] as const;

const HEALTH_SECTIONS = [
  { key: 'MEALS', label: 'Öğünler' },
  { key: 'TRACKING', label: 'Takip' },
] as const;

const MACRO_CHART_OPTIONS = [
  { key: 'calories', label: 'Kalori', suffix: ' kcal' },
  { key: 'protein', label: 'Protein', suffix: ' g' },
  { key: 'carbs', label: 'Karb', suffix: ' g' },
  { key: 'fat', label: 'Yağ', suffix: ' g' },
] as const;

const HEALTH_CHART_OPTIONS = [
  { key: 'burnedCalories', label: 'Yakılan Kalori', suffix: ' kcal' },
  { key: 'steps', label: 'Adım', suffix: '' },
] as const;

type WeeklyMealPoint = {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};

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

function formatShortDayLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('tr-TR', {
    weekday: 'short',
  });
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildRecentDateRange(days: number) {
  const dates: string[] = [];
  const today = new Date();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() - offset);
    dates.push(toLocalDateString(nextDate));
  }

  return dates;
}

function buildCurrentWeekRange() {
  const today = new Date();
  const currentWeekday = today.getDay();
  const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const nextDate = new Date(monday);
    nextDate.setDate(monday.getDate() + index);
    return toLocalDateString(nextDate);
  });
}

function getMealLabel(mealType: string) {
  return MEAL_TYPES.find((item) => item.key === mealType)?.label ?? mealType;
}

function getUnitLabel(unitType: string) {
  return UNIT_TYPES.find((item) => item.key === unitType)?.label ?? unitType;
}

function getMealItemTitle(item: MealLogItemResponse) {
  return item.sourceName ?? item.foodName ?? 'Bilinmeyen öğe';
}

function getMealItemAdjustLabel(item: MealLogItemResponse) {
  if (item.sourceType === 'RECIPE') {
    return 'Hızlı düzenle (0.5 porsiyon)';
  }

  return `Hızlı düzenle (${item.unitType === 'PIECE' ? '1 tane' : '25 g'})`;
}

export default function ShoppingListTabScreen() {
  const { accessToken, isLoggedIn } = useAuth();
  const hasAutoSyncedRef = useRef(false);

  const [records, setRecords] = useState<HealthTransferResponse[]>([]);
  const [dailyMeals, setDailyMeals] = useState<DailyMealLogsResponse | null>(null);
  const [foodResults, setFoodResults] = useState<FoodProductSearchItemResponse[]>([]);
  const [recipeResults, setRecipeResults] = useState<RecipeListItemResponse[]>([]);
  const [searchType, setSearchType] = useState<(typeof SEARCH_TYPES)[number]['key']>('FOOD');
  const [activeSection, setActiveSection] = useState<(typeof HEALTH_SECTIONS)[number]['key']>('MEALS');
  const [activeMacroChart, setActiveMacroChart] = useState<(typeof MACRO_CHART_OPTIONS)[number]['key']>('calories');
  const [activeHealthChart, setActiveHealthChart] = useState<(typeof HEALTH_CHART_OPTIONS)[number]['key']>('burnedCalories');
  const [foodQuery, setFoodQuery] = useState('');
  const [recipeQuery, setRecipeQuery] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<(typeof MEAL_TYPES)[number]['key']>('BREAKFAST');
  const [selectedUnitType, setSelectedUnitType] = useState<(typeof UNIT_TYPES)[number]['key']>('GRAM');
  const [foodQuantityInput, setFoodQuantityInput] = useState('100');
  const [recipeServingsInput, setRecipeServingsInput] = useState('1');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyMealHistory, setWeeklyMealHistory] = useState<WeeklyMealPoint[]>([]);
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
        const nextWeeklyMealsPromise = accessToken
          ? Promise.all(buildCurrentWeekRange().map((date) => getDailyMeals(accessToken, date)))
          : Promise.resolve([]);
        const [nextRecords, nextMeals, nextWeeklyMeals] = await Promise.all([
          nextRecordsPromise,
          nextMealsPromise,
          nextWeeklyMealsPromise,
        ]);

        setRecords(nextRecords);
        setDailyMeals(nextMeals);
        setWeeklyMealHistory(
          nextWeeklyMeals.map((item) => ({
            date: item.logDate,
            totalCalories: item.totalCalories,
            totalProtein: item.totalProtein,
            totalCarbs: item.totalCarbs,
            totalFat: item.totalFat,
          }))
        );
        setErrorMessage('');
      } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Veriler yüklenemedi.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

  const syncHealthData = useCallback(async () => {
    if (syncingHealth) {
      return;
    }

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
        'HealthKit hatasi:',
        e,
        e instanceof Error ? e.message : 'unknown',
        JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}))
      );
      setErrorMessage('HealthKit baglantisi kurulamadi.');
    } finally {
      setSyncingHealth(false);
    }
  }, [loadDashboard, syncingHealth]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      hasAutoSyncedRef.current = false;
    }, [])
  );

  useEffect(() => {
    if (!isLoggedIn) {
      hasAutoSyncedRef.current = false;
      return;
    }

    if (hasAutoSyncedRef.current) {
      return;
    }

    hasAutoSyncedRef.current = true;
    void syncHealthData();
  }, [isLoggedIn, syncHealthData]);

  useEffect(() => {
    const normalizedQuery = foodQuery.trim();
    if (!isLoggedIn || normalizedQuery.length < 2) {
      setFoodResults([]);
      setFoodSearchLoading(false);
      return;
    }

    setFoodSearchLoading(true);
    const timeoutId = setTimeout(() => {
      void searchFoodProducts(normalizedQuery, 5)
        .then((results) => {
          setFoodResults(results);
          setErrorMessage('');
        })
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : 'Ürün arama başarısız oldu.');
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
          setRecipeResults(results.slice(0, 5));
          setErrorMessage('');
        })
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : 'Tarif arama başarısız oldu.');
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

  const weeklyHealthHistory = useMemo(() => {
    const recentDates = buildCurrentWeekRange();
    const latestByDate = new Map(
      dailyLatestRecords.map((item) => [
        getDayKey(item.date),
        item,
      ])
    );

    return recentDates.map((date) => {
      const record = latestByDate.get(date);

      return {
        id: record?.id ?? `missing-${date}`,
        date,
        adim: record?.adim ?? 0,
        kalori: record?.kalori ?? 0,
      };
    });
  }, [dailyLatestRecords]);

  const weeklyHealthMaxCalories = useMemo(
    () => Math.max(...weeklyHealthHistory.map((item) => item.kalori), 0),
    [weeklyHealthHistory]
  );

  const weeklyHealthMaxSteps = useMemo(
    () => Math.max(...weeklyHealthHistory.map((item) => item.adim), 0),
    [weeklyHealthHistory]
  );
  const activeHealthChartConfig =
    HEALTH_CHART_OPTIONS.find((item) => item.key === activeHealthChart) ?? HEALTH_CHART_OPTIONS[0];

  const activeMacroConfig = MACRO_CHART_OPTIONS.find((item) => item.key === activeMacroChart) ?? MACRO_CHART_OPTIONS[0];
  const activeMacroMax = useMemo(() => {
    const values = weeklyMealHistory.map((item) => {
      switch (activeMacroChart) {
        case 'protein':
          return item.totalProtein;
        case 'carbs':
          return item.totalCarbs;
        case 'fat':
          return item.totalFat;
        case 'calories':
        default:
          return item.totalCalories;
      }
    });

    return Math.max(...values, 0);
  }, [activeMacroChart, weeklyMealHistory]);


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
      setErrorMessage(error instanceof Error ? error.message : 'Ürün öğüne eklenemedi.');
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
      setErrorMessage(error instanceof Error ? error.message : 'Tarif öğüne eklenemedi.');
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
          throw new Error('Tarif bilgisi eksik.');
        }

        await updateRecipeMealItem(accessToken, item.id, {
          mealType,
          recipeId: item.sourceId,
          servings: nextQuantity,
        });
      } else {
        if (item.foodProductId == null) {
          throw new Error('Ürün bilgisi eksik.');
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
      setErrorMessage(error instanceof Error ? error.message : 'Öğün güncellenemedi.');
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
      setErrorMessage(error instanceof Error ? error.message : 'Öğün öğesi silinemedi.');
    } finally {
      setSubmittingItemId(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || syncingHealth}
            onRefresh={() => {
              if (isLoggedIn) {
                void syncHealthData();
                return;
              }

              void loadDashboard(true);
            }}
          />
        }>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ReciPulse Sağlık</Text>
          <Text style={styles.title}>Sağlık ve Öğün Takibi</Text>
          <Text style={styles.subtitle}>
            Günlük öğünlerini ürün ve tarif bazlı ekle, makroları otomatik hesapla ve sağlık verilerinle aynı
            ekranda takip et.
          </Text>
        </View>

        {!loading ? (
          <View style={styles.sectionSwitch}>
            {HEALTH_SECTIONS.map((section) => {
              const active = activeSection === section.key;

              return (
                <Pressable
                  key={section.key}
                  style={[styles.sectionSwitchButton, active ? styles.sectionSwitchButtonActive : null]}
                  onPress={() => setActiveSection(section.key)}>
                  <Text style={[styles.sectionSwitchText, active ? styles.sectionSwitchTextActive : null]}>
                    {section.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>Veriler yükleniyor...</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Bağlantı Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {!loading && !isLoggedIn ? (
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Öğün takibi için giriş yap</Text>
            <Text style={styles.authBody}>
              Ürün arama, öğüne ekleme ve kullanıcıya özel kayıtları görebilmek için önce profil ekranından giriş
              yapman gerekiyor.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.primaryButtonText}>Profili Aç</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && isLoggedIn && activeSection === 'MEALS' ? (
          <>
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Bugünün Öğünleri</Text>

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
                                : item.sourceType === 'CUSTOM'
                                ? `Tahmini • ${formatNumber(item.calories, ' kcal')}`
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

                        {item.sourceType !== 'CUSTOM' && (
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
                        )}
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Bugün henüz öğün eklenmedi</Text>
                  <Text style={styles.emptyBody}>
                    Yukarıdan bir ürün ya da tarif arayıp kahvaltı, öğle, akşam ya da ara öğüne ekleyebilirsin.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.mealComposerCard}>
              <Text style={styles.sectionTitle}>Öğün Ekle</Text>

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
                    ? 'Ürün ara: yumurta, haşlanmış yumurta, patates...'
                    : 'Tarif ara: makarna, tavuklu salata, çorba...'
                }
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />

              {searchType === 'FOOD' && foodSearchLoading ? (
                <Text style={styles.inlineHint}>Ürünler aranıyor...</Text>
              ) : null}

              {searchType === 'RECIPE' && recipeSearchLoading ? (
                <Text style={styles.inlineHint}>Tarif arama sürüyor...</Text>
              ) : null}

              {searchType === 'FOOD' && foodQuery.trim().length < 2 ? (
                <Text style={styles.inlineHint}>Arama için en az 2 karakter gir.</Text>
              ) : null}

              {searchType === 'RECIPE' && recipeQuery.trim().length < 2 ? (
                <Text style={styles.inlineHint}>Tarif aramak için en az 2 karakter gir.</Text>
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
                      Hazırlama: {recipe.readyInMinutes ? `${recipe.readyInMinutes} dk` : 'Bilinmiyor'}
                    </Text>
                  </View>
                ))}
            </View>

            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartEyebrow}>Beslenme Trendi</Text>
                  <Text style={styles.chartTitle}>Son 7 Gün</Text>
                </View>
                <Text style={styles.chartValue}>
                  {formatNumber(
                    activeMacroChart === 'protein'
                      ? dailyMeals?.totalProtein
                      : activeMacroChart === 'carbs'
                        ? dailyMeals?.totalCarbs
                        : activeMacroChart === 'fat'
                          ? dailyMeals?.totalFat
                          : dailyMeals?.totalCalories,
                    activeMacroConfig.suffix
                  )}
                </Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartSwitch}>
                {MACRO_CHART_OPTIONS.map((option) => {
                  const active = option.key === activeMacroChart;

                  return (
                    <Pressable
                      key={option.key}
                      style={[styles.chartChip, active ? styles.chartChipActive : null]}
                      onPress={() => setActiveMacroChart(option.key)}>
                      <Text style={[styles.chartChipText, active ? styles.chartChipTextActive : null]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.weekChart}>
                {weeklyMealHistory.map((item) => {
                  const value =
                    activeMacroChart === 'protein'
                      ? item.totalProtein
                      : activeMacroChart === 'carbs'
                        ? item.totalCarbs
                        : activeMacroChart === 'fat'
                          ? item.totalFat
                          : item.totalCalories;
                  const ratio = activeMacroMax > 0 ? value / activeMacroMax : 0;

                  return (
                    <View key={`meals-macro-${item.date}`} style={styles.weekBarWrap}>
                      <Text style={styles.weekBarValue}>{Math.round(value)}</Text>
                      <View style={styles.weekBarTrack}>
                        <View style={[styles.weekBarFill, { height: `${ratio * 100}%` }]} />
                      </View>
                      <Text style={styles.weekBarLabel}>{formatShortDayLabel(item.date)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {!loading && activeSection === 'TRACKING' ? (
          <>
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartEyebrow}>Aktivite Trendi</Text>
                  <Text style={styles.chartTitle}>{activeHealthChartConfig.label}</Text>
                </View>
                <Text style={styles.chartValue}>
                  {formatNumber(
                    activeHealthChart === 'steps' ? todayRecord?.adim : todayRecord?.kalori,
                    activeHealthChartConfig.suffix
                  )}
                </Text>
              </View>

              <View style={styles.chartSwitchWrap}>
                {HEALTH_CHART_OPTIONS.map((option) => {
                  const active = option.key === activeHealthChart;

                  return (
                    <Pressable
                      key={option.key}
                      style={[styles.chartChip, active ? styles.chartChipActive : null]}
                      onPress={() => setActiveHealthChart(option.key)}>
                      <Text style={[styles.chartChipText, active ? styles.chartChipTextActive : null]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.weekChart}>
                {weeklyHealthHistory.map((item) => {
                  const value = activeHealthChart === 'steps' ? item.adim : item.kalori;
                  const maxValue = activeHealthChart === 'steps' ? weeklyHealthMaxSteps : weeklyHealthMaxCalories;
                  const ratio = maxValue > 0 ? value / maxValue : 0;

                  return (
                    <View key={`health-${activeHealthChart}-${item.id}`} style={styles.weekBarWrap}>
                      <Text style={styles.weekBarValue}>{Math.round(value)}</Text>
                      <View style={styles.weekBarTrack}>
                        <View style={[styles.weekBarFill, { height: `${ratio * 100}%` }]} />
                      </View>
                      <Text style={styles.weekBarLabel}>{formatShortDayLabel(item.date)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}
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
  eyebrow: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111111',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#6E6E73',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loaderText: {
    color: '#6E6E73',
    fontSize: 15,
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8ED',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  messageTitle: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  messageBody: {
    color: '#6E6E73',
    fontSize: 14,
    lineHeight: 20,
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    gap: 10,
  },
  authTitle: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '700',
  },
  authBody: {
    color: '#6E6E73',
    fontSize: 14,
    lineHeight: 21,
  },
  sectionSwitch: {
    flexDirection: 'row',
    backgroundColor: '#ECECEF',
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  sectionSwitchButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionSwitchButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  sectionSwitchText: {
    color: '#6E6E73',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionSwitchTextActive: {
    color: '#111111',
  },
  mealComposerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartEyebrow: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  chartTitle: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '700',
  },
  chartValue: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  chartSwitch: {
    gap: 8,
  },
  chartSwitchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chartChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  chartChipActive: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  chartChipText: {
    color: '#3A3A3C',
    fontSize: 12,
    fontWeight: '700',
  },
  chartChipTextActive: {
    color: '#FFFFFF',
  },
  weekChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 170,
  },
  weekBarWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  weekBarValue: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  weekBarTrack: {
    width: '100%',
    maxWidth: 28,
    height: 110,
    borderRadius: 16,
    backgroundColor: '#F0F0F2',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBarFill: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
  },
  weekBarLabel: {
    color: '#6E6E73',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '700',
  },
  chipRow: {
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  chipActive: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  chipText: {
    color: '#3A3A3C',
    fontSize: 12,
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
    backgroundColor: '#F5F5F7',
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
    backgroundColor: '#1C1C1E',
  },
  modeButtonText: {
    color: '#6E6E73',
    fontSize: 12,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  quantityInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  unitSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 4,
    gap: 4,
  },
  recipeServingBadge: {
    minWidth: 108,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  recipeServingBadgeText: {
    color: '#6E6E73',
    fontSize: 12,
    fontWeight: '700',
  },
  unitButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unitButtonActive: {
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
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#111111',
    fontSize: 14,
  },
  inlineHint: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  foodCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8ED',
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
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  foodMeta: {
    color: '#6E6E73',
    fontSize: 12,
    lineHeight: 18,
  },
  foodSubMeta: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonSmall: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    gap: 6,
  },
  metricLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: '#111111',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  historySection: {
    gap: 12,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    gap: 10,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  dailyTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  dailyBadge: {
    color: '#8E8E93',
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
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E8E8ED',
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
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  mealItemMeta: {
    color: '#6E6E73',
    fontSize: 12,
    lineHeight: 18,
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  deleteButtonText: {
    color: '#3A3A3C',
    fontSize: 12,
    fontWeight: '700',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  adjustButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#1C1C1E',
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
    color: '#6E6E73',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    gap: 6,
  },
  emptyTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    color: '#6E6E73',
    fontSize: 14,
    lineHeight: 20,
  },
  highlightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  highlightEyebrow: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  highlightTitle: {
    color: '#111111',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  highlightBody: {
    color: '#6E6E73',
    fontSize: 14,
    lineHeight: 21,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLabel: {
    color: '#6E6E73',
    fontSize: 14,
    fontWeight: '600',
  },
  recordValue: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  recordDate: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
});
