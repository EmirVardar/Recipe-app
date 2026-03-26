import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecipeAccessBanner } from '@/components/recipe-access-banner';
import { getRecipeDetail, type RecipeDetailResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function formatValue(value: number | null | undefined, suffix = '') {
  if (value == null) {
    return '-';
  }

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${suffix}`;
}

function stripHtml(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { accessToken, isLoggedIn } = useAuth();
  const [recipe, setRecipe] = useState<RecipeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const recipeId = Number(params.id);
    if (!isLoggedIn || !accessToken || !recipeId) {
      setLoading(false);
      return;
    }

    const loadRecipe = async () => {
      setLoading(true);
      try {
        const detail = await getRecipeDetail(accessToken, recipeId);
        setRecipe(detail);
        setErrorMessage('');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Tarif detayi yuklenemedi.');
      } finally {
        setLoading(false);
      }
    };

    void loadRecipe();
  }, [accessToken, isLoggedIn, params.id]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ title: recipe?.title ?? 'Tarif Detayi', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!isLoggedIn ? <RecipeAccessBanner /> : null}

        {isLoggedIn && loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>Tarif detayi yukleniyor...</Text>
          </View>
        ) : null}

        {isLoggedIn && errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Baglanti Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoggedIn && recipe ? (
          <View style={styles.detailCard}>
            <Image
              source={{
                uri:
                  recipe.image ??
                  'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80',
              }}
              style={styles.heroImage}
            />

            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.summary}>{stripHtml(recipe.summary) || 'Bu tarif icin ozet bilgisi bulunmuyor.'}</Text>

            <View style={styles.metrics}>
              <View style={styles.metricPill}>
                <Text style={styles.metricLabel}>Kalori</Text>
                <Text style={styles.metricValue}>{formatValue(recipe.nutrition?.calories)}</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricLabel}>Protein</Text>
                <Text style={styles.metricValue}>{formatValue(recipe.nutrition?.protein, ' g')}</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricLabel}>Karb</Text>
                <Text style={styles.metricValue}>{formatValue(recipe.nutrition?.carbs, ' g')}</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricLabel}>Yag</Text>
                <Text style={styles.metricValue}>{formatValue(recipe.nutrition?.fat, ' g')}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Icindekiler</Text>
              {recipe.ingredients.map((ingredient) => (
                <Text key={`${recipe.id}-${ingredient.ingredientId}`} style={styles.sectionItem}>
                  • {ingredient.originalText || ingredient.name}
                </Text>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adimlar</Text>
              {recipe.steps.map((step) => (
                <Text key={`${recipe.id}-step-${step.stepNumber}`} style={styles.sectionItem}>
                  {step.stepNumber}. {step.instruction}
                </Text>
              ))}
            </View>
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
    padding: 18,
    gap: 18,
    paddingBottom: 32,
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
  detailCard: {
    gap: 18,
  },
  heroImage: {
    width: '100%',
    height: 240,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
  },
  title: {
    color: '#111827',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  summary: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 23,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    minWidth: '47%',
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  metricLabel: {
    color: '#9A3412',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionItem: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 21,
  },
});
