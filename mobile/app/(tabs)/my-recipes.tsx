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

import { RecipeAccessBanner } from '@/components/recipe-access-banner';
import { getRecipes, type RecipeListItemResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function formatValue(value: number | null | undefined, suffix = '') {
  if (value == null) {
    return '-';
  }

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${suffix}`;
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
      const nextRecipes = await getRecipes(accessToken);
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRecipes(true)} />}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ReciPulse Tarif Kutusu</Text>
          <Text style={styles.title}>Tariflerim</Text>
          <Text style={styles.subtitle}>{"Backend'den gelen tarifleri burada sade bir listede tutuyoruz."}</Text>
        </View>

        {!isLoggedIn ? <RecipeAccessBanner onOpenProfile={() => router.push('/(tabs)/profile')} /> : null}

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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardImage: {
    width: '100%',
    height: 190,
    backgroundColor: '#E5E7EB',
  },
  cardBody: {
    padding: 18,
    gap: 12,
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
