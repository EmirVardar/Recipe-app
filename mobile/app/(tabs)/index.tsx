import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  type RecipeListItemResponse,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

const CATEGORY_CHIPS = [
  { label: 'Tumu', value: '' },
  { label: 'Kahvalti', value: 'breakfast' },
  { label: 'Salata', value: 'salad' },
  { label: 'Corba', value: 'soup' },
  { label: 'Tatli', value: 'dessert' },
  { label: 'Ana Yemek', value: 'main' },
];

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
      return 'Kahvalti';
    case 'lunch':
      return 'Ogle Yemegi';
    case 'dinner':
      return 'Aksam Yemegi';
    case 'dessert':
      return 'Tatli';
    case 'snack':
      return 'Atistirmalik';
    case 'drink':
      return 'Icecek';
    case 'soup':
      return 'Corba';
    case 'salad':
      return 'Salata';
    default:
      return 'Ana Yemek';
  }
}

export default function HomeTabScreen() {
  const { accessToken, isLoggedIn } = useAuth();
  const [recipes, setRecipes] = useState<RecipeListItemResponse[]>([]);
  const [filters, setFilters] = useState<RecipeFilters>(defaultRecipeFilters);
  const [appliedFilters, setAppliedFilters] = useState<RecipeFilters>(defaultRecipeFilters);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

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
      const nextRecipes = await getRecipes(accessToken, appliedFilters);
      setRecipes(nextRecipes);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Tarifler yuklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, appliedFilters]);

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
          <Text style={styles.eyebrow}>ReciPulse Kesfet</Text>
          <Text style={styles.title}>Tum Tarifler</Text>
          <Text style={styles.subtitle}>
            Begendigin tarifleri kalp ile kaydet. Favoriye eklediklerin direkt Tariflerim sekmesine duser.
          </Text>
        </View>

        {!isLoggedIn ? <RecipeAccessBanner onOpenProfile={() => router.push('/(tabs)/profile')} /> : null}

        {isLoggedIn ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {CATEGORY_CHIPS.map((chip) => {
              const active = filters.category === chip.value;
              return (
                <Pressable
                  key={chip.value || 'all'}
                  style={[styles.categoryChip, active ? styles.categoryChipActive : null]}
                  onPress={() => {
                    setFilters((current) => ({ ...current, category: chip.value }));
                    setAppliedFilters((current) => ({ ...current, category: chip.value }));
                  }}>
                  <Text style={[styles.categoryChipText, active ? styles.categoryChipTextActive : null]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {isLoggedIn ? (
          <RecipeFiltersCard
            value={filters}
            onChange={setFilters}
            onApply={() => {
              setAppliedFilters({ ...filters });
            }}
            onReset={() => {
              setFilters(defaultRecipeFilters);
              setAppliedFilters(defaultRecipeFilters);
            }}
          />
        ) : null}

        {errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Baglanti Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoggedIn && loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>Tarifler yukleniyor...</Text>
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
  list: {
    gap: 14,
  },
  categoryRow: {
    gap: 10,
    paddingRight: 18,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryChipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#E5E7EB',
  },
  favoriteButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  favoriteButtonActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  favoriteButtonText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '800',
  },
  favoriteButtonTextActive: {
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 18,
    gap: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTopRow: {
    gap: 12,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
  },
  calorieBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  calorieBadgeText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  metaDot: {
    color: '#D1D5DB',
    fontSize: 14,
  },
});
