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
import { useFocusEffect } from '@react-navigation/native';

import { RecipeAccessBanner } from '@/components/recipe-access-banner';
import { getFavoriteRecipes, type RecipeListItemResponse } from '@/lib/api';
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

export default function MyRecipesTabScreen() {
  const { accessToken, isLoggedIn } = useAuth();
  const [recipes, setRecipes] = useState<RecipeListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      const nextRecipes = await getFavoriteRecipes(accessToken);
      setRecipes(nextRecipes);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Tarifler yuklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  useFocusEffect(
    useCallback(() => {
      void loadRecipes();
    }, [loadRecipes])
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRecipes(true)} />}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ReciPulse Tarif Kutusu</Text>
          <Text style={styles.title}>Tariflerim</Text>
          <Text style={styles.subtitle}>Favoriye eklediğin tarifler burada kişisel listen olarak tutulur.</Text>
        </View>

        {!isLoggedIn ? <RecipeAccessBanner onOpenProfile={() => router.push('/(tabs)/profile')} /> : null}

        {errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Bağlantı Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoggedIn && loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>Tarifler yükleniyor...</Text>
          </View>
        ) : isLoggedIn ? (
          recipes.length > 0 ? (
            <View style={styles.list}>
              {recipes.map((recipe) => {
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
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Henüz favori yok</Text>
              <Text style={styles.emptyBody}>Ana sayfada kalp butonuyla beğendiğin tarifleri buraya ekleyebilirsin.</Text>
            </View>
          )
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
    maxWidth: 320,
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
  list: {
    gap: 14,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  cardImage: {
    width: '100%',
    height: 212,
    backgroundColor: '#E5E7EB',
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
    fontSize: 23,
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
