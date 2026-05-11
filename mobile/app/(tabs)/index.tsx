import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RecipeAccessBanner } from '@/components/recipe-access-banner';
import { defaultRecipeFilters, RecipeFiltersCard, type RecipeFilters } from '@/components/recipe-filters';
import {
  addFavoriteRecipe,
  getRecipes,
  removeFavoriteRecipe,
  searchRecipes,
  type RecipeListItemResponse,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

function formatValue(value: number | null | undefined, suffix = '') {
  if (value == null) {
    return '-';
  }

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${suffix}`;
}

function formatCategoryLabel(category: string | null | undefined) {
  switch (category) {
    case 'breakfast':
      return 'Kahvaltı';
    case 'lunch':
      return 'Öğle Yemeği';
    case 'dinner':
      return 'Akşam Yemeği';
    case 'dessert':
      return 'Tatlı';
    case 'snack':
      return 'Atıştırmalık';
    case 'drink':
      return 'İçecek';
    case 'soup':
      return 'Çorba';
    case 'salad':
      return 'Salata';
    default:
      return 'Ana Yemek';
  }
}

export default function HomeTabScreen() {
  const { accessToken, isLoggedIn } = useAuth();
  const [recipes, setRecipes] = useState<RecipeListItemResponse[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<RecipeFilters>(defaultRecipeFilters);
  const [appliedFilters, setAppliedFilters] = useState<RecipeFilters>(defaultRecipeFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const activeFilterCount = [
    appliedFilters.minCalories.trim().length > 0,
    appliedFilters.maxCalories.trim().length > 0,
    appliedFilters.highProtein,
    appliedFilters.shortTime,
    appliedFilters.vegetarian,
    appliedFilters.vegan,
  ].filter(Boolean).length;

  const loadRecipes = useCallback(async (isRefresh = false) => {
    if (!accessToken) {
      setRecipes([]);
      setErrorMessage('');
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
      const normalizedQuery = query.trim();
      const nextRecipes = normalizedQuery
        ? await searchRecipes(accessToken, normalizedQuery, appliedFilters)
        : await getRecipes(accessToken, appliedFilters);
      setRecipes(normalizedQuery ? nextRecipes.slice(0, 5) : nextRecipes);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Tarifler yuklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, appliedFilters, query]);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  const handleFavoriteToggle = async (recipe: RecipeListItemResponse) => {
    if (!accessToken) {
      return;
    }

    setFavoriteLoadingId(recipe.id);
    const nextFavorited = !recipe.favorited;

    setRecipes((current) =>
      current.map((item) => (item.id === recipe.id ? { ...item, favorited: nextFavorited } : item))
    );

    try {
      if (recipe.favorited) {
        await removeFavoriteRecipe(accessToken, recipe.id);
      } else {
        await addFavoriteRecipe(accessToken, recipe.id);
      }
    } catch (error) {
      setRecipes((current) =>
        current.map((item) => (item.id === recipe.id ? { ...item, favorited: recipe.favorited } : item))
      );
      setErrorMessage(error instanceof Error ? error.message : 'Favori islemi basarisiz oldu.');
    } finally {
      setFavoriteLoadingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRecipes(true)} />}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ReciPulse Keşfet</Text>
          <Text style={styles.title}>Tüm Tarifler</Text>
          <Text style={styles.subtitle}>
            Beğendiğin tarifleri kalp ile kaydet. Favoriye eklediklerin direkt Tariflerim sekmesine düşer.
          </Text>
        </View>

        {!isLoggedIn ? <RecipeAccessBanner onOpenProfile={() => router.push('/(tabs)/profile')} /> : null}

        {isLoggedIn ? (
          <View style={styles.searchCard}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Tarif ya da malzeme ara"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => {
                  void loadRecipes();
                }}
              />
              {query.trim().length > 0 ? (
                <Pressable onPress={() => {
                  setQuery('');
                  setErrorMessage('');
                }}>
                  <Ionicons name="close-circle" size={18} color="#D1D5DB" />
                </Pressable>
              ) : null}
            </View>

            <Pressable style={styles.searchButton} onPress={() => void loadRecipes()}>
              <Text style={styles.searchButtonText}>{query.trim().length > 0 ? 'Ara' : 'Tümünü Göster'}</Text>
            </Pressable>
          </View>
        ) : null}

        {isLoggedIn ? (
          <View style={styles.filterSection}>
            <Pressable
              style={[styles.filterToggleButton, filtersOpen ? styles.filterToggleButtonOpen : null]}
              onPress={() => setFiltersOpen((current) => !current)}>
              <View style={styles.filterToggleLeft}>
                <Ionicons name="options-outline" size={18} color={filtersOpen ? '#FFFFFF' : '#EA580C'} />
                <Text style={[styles.filterToggleText, filtersOpen ? styles.filterToggleTextOpen : null]}>
                  Filtrele
                </Text>
              </View>
              <View style={styles.filterToggleRight}>
                {activeFilterCount > 0 ? (
                  <View style={[styles.filterCountBadge, filtersOpen ? styles.filterCountBadgeOpen : null]}>
                    <Text style={[styles.filterCountText, filtersOpen ? styles.filterCountTextOpen : null]}>
                      {activeFilterCount}
                    </Text>
                  </View>
                ) : null}
                <Ionicons
                  name={filtersOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={filtersOpen ? '#FFFFFF' : '#6B7280'}
                />
              </View>
            </Pressable>

            {filtersOpen ? (
              <RecipeFiltersCard
                value={filters}
                onChange={setFilters}
                onApply={() => {
                  setAppliedFilters({ ...filters });
                  setFiltersOpen(false);
                }}
                onReset={() => {
                  setFilters(defaultRecipeFilters);
                  setAppliedFilters(defaultRecipeFilters);
                  setFiltersOpen(false);
                }}
              />
            ) : null}
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Bağlantı Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoggedIn && loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>{query.trim().length > 0 ? 'Tarifler aranıyor...' : 'Tarifler yükleniyor...'}</Text>
          </View>
        ) : isLoggedIn && recipes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {query.trim().length > 0 ? 'Sonuç bulunamadı' : 'Tarif bulunamadı'}
            </Text>
            <Text style={styles.emptyBody}>
              {query.trim().length > 0
                ? 'Daha genel bir tarif adı ya da malzeme ile tekrar dene.'
                : 'Filtreleri temizleyip tekrar deneyebilirsin.'}
            </Text>
          </View>
        ) : isLoggedIn ? (
          <View style={styles.list}>
            {recipes.map((recipe) => {
              const favoriteBusy = favoriteLoadingId === recipe.id;

              return (
                <Pressable key={recipe.id} style={styles.card} onPress={() => router.push(`/recipes/${recipe.id}`)}>
                  <Image
                    source={{
                      uri:
                        recipe.image ??
                        'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80',
                    }}
                    style={styles.cardImage}
                  />

                  <Pressable
                    style={[styles.favoriteButton, recipe.favorited ? styles.favoriteButtonActive : null]}
                    onPress={(event) => {
                      event.stopPropagation();
                      void handleFavoriteToggle(recipe);
                    }}>
                    <Ionicons
                      name={recipe.favorited ? 'heart' : 'heart-outline'}
                      size={18}
                      color={recipe.favorited ? '#FFFFFF' : '#9A3412'}
                    />
                    <Text style={[styles.favoriteButtonText, recipe.favorited ? styles.favoriteButtonTextActive : null]}>
                      {favoriteBusy ? '...' : recipe.favorited ? 'Kaydedildi' : 'Kaydet'}
                    </Text>
                  </Pressable>

                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{formatCategoryLabel(recipe.primaryCategory)}</Text>
                      </View>
                      <Text style={styles.cardTitle}>{recipe.title}</Text>
                      <View style={styles.calorieBadge}>
                        <Text style={styles.calorieBadgeText}>{formatValue(recipe.calories, ' kcal')}</Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>{formatValue(recipe.readyInMinutes, ' dk')}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>{formatValue(recipe.servings, ' porsiyon')}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.9,
  },
  subtitle: {
    color: '#6E6E73',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    padding: 10,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  searchInputWrap: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
  },
  searchButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0D5C7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  messageTitle: {
    color: '#A14A22',
    fontSize: 15,
    fontWeight: '700',
  },
  messageBody: {
    color: '#6E6E73',
    fontSize: 14,
    lineHeight: 20,
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
  list: {
    gap: 14,
  },
  filterSection: {
    gap: 10,
  },
  filterToggleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterToggleButtonOpen: {
    backgroundColor: '#F0EEEA',
    borderColor: '#E3DED8',
  },
  filterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleText: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '700',
  },
  filterToggleTextOpen: {
    color: '#1C1C1E',
  },
  filterCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountBadgeOpen: {
    backgroundColor: '#FFFFFF',
  },
  filterCountText: {
    color: '#6E6E73',
    fontSize: 11,
    fontWeight: '700',
  },
  filterCountTextOpen: {
    color: '#3A3A3C',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  cardImage: {
    width: '100%',
    height: 224,
    backgroundColor: '#E5E7EB',
  },
  favoriteButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  favoriteButtonActive: {
    backgroundColor: '#1C1C1E',
  },
  favoriteButtonText: {
    color: '#1C1C1E',
    fontSize: 11,
    fontWeight: '700',
  },
  favoriteButtonTextActive: {
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 18,
    gap: 10,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    color: '#6E6E73',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardTopRow: {
    gap: 10,
  },
  cardTitle: {
    color: '#111111',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  calorieBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  calorieBadgeText: {
    color: '#6E6E73',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#6E6E73',
    fontSize: 13,
    fontWeight: '600',
  },
  metaDot: {
    color: '#C7C7CC',
    fontSize: 14,
  },
});
