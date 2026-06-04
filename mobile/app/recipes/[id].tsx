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

const UNIT_TRANSLATIONS: Record<string, string> = {
  small: 'küçük',
  medium: 'orta',
  large: 'büyük',
  xlarge: 'çok büyük',
  whole: 'bütün',
  halves: 'yarım',
  half: 'yarım',
  quarter: 'çeyrek',
  quarters: 'çeyrek',
  g: 'g',
  gram: 'g',
  grams: 'g',
  gr: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  l: 'l',
  lt: 'l',
  liter: 'l',
  liters: 'l',
  cup: 'su bardağı',
  cups: 'su bardağı',
  serving: 'porsiyon',
  servings: 'porsiyon',
  tbsp: 'yemek kaşığı',
  tablespoon: 'yemek kaşığı',
  tablespoons: 'yemek kaşığı',
  tsp: 'çay kaşığı',
  teaspoon: 'çay kaşığı',
  teaspoons: 'çay kaşığı',
  dessertspoon: 'tatlı kaşığı',
  dessertspoons: 'tatlı kaşığı',
  handful: 'avuç',
  handfuls: 'avuç',
  clove: 'diş',
  cloves: 'diş',
  piece: 'adet',
  pieces: 'adet',
  pc: 'adet',
  pcs: 'adet',
  unit: 'adet',
  units: 'adet',
  slice: 'dilim',
  slices: 'dilim',
  strip: 'şerit',
  strips: 'şerit',
  stalk: 'sap',
  stalks: 'sap',
  stick: 'çubuk',
  sticks: 'çubuk',
  cube: 'küp',
  cubes: 'küp',
  leaf: 'yaprak',
  leaves: 'yaprak',
  pinch: 'tutam',
  pinches: 'tutam',
  dash: 'çimdik',
  dashes: 'çimdik',
  oz: 'ons',
  ounce: 'ons',
  ounces: 'ons',
  lb: 'lb',
  pound: 'pound',
  pounds: 'pound',
  can: 'konserve',
  cans: 'konserve',
  jar: 'kavanoz',
  jars: 'kavanoz',
  bottle: 'şişe',
  bottles: 'şişe',
  bag: 'paket',
  bags: 'paket',
  package: 'paket',
  packages: 'paket',
  packet: 'paket',
  packets: 'paket',
  bunch: 'demet',
  bunches: 'demet',
  loaf: 'somun',
  loaves: 'somun',
  sprig: 'dal',
  sprigs: 'dal',
  head: 'adet',
  heads: 'adet',
  ear: 'koçan',
  ears: 'koçan',
};

function translateUnit(unit: string | null | undefined) {
  const normalized = unit?.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  return UNIT_TRANSLATIONS[normalized] ?? unit!.trim();
}

function formatIngredientLine(ingredient: RecipeDetailResponse['ingredients'][number]) {
  const hasAmount = ingredient.amount != null;
  const unit = translateUnit(ingredient.unit);

  if (!hasAmount) {
    return ingredient.name;
  }

  const amountText = Number.isInteger(ingredient.amount)
    ? String(ingredient.amount)
    : ingredient.amount.toFixed(1);

  if (unit) {
    return `${amountText} ${unit} ${ingredient.name}`;
  }

  return `${amountText} ${ingredient.name}`;
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
      <Stack.Screen options={{ title: recipe?.title ?? 'Tarif Detayı', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!isLoggedIn ? <RecipeAccessBanner /> : null}

        {isLoggedIn && loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.loaderText}>Tarif detayı yükleniyor...</Text>
          </View>
        ) : null}

        {isLoggedIn && errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Bağlantı Notu</Text>
            <Text style={styles.messageBody}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoggedIn && recipe ? (
          <View style={styles.detailLayout}>
            <Image
              source={{
                uri:
                  recipe.image ??
                  'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80',
              }}
              style={styles.heroImage}
            />

            <View style={styles.heroContent}>
              <Text style={styles.eyebrow}>Tarif Detayı</Text>
              <Text style={styles.title}>{recipe.title}</Text>

              <View style={styles.topMetaRow}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{formatCategoryLabel(recipe.primaryCategory)}</Text>
                </View>
                <View style={styles.quickMeta}>
                  <Text style={styles.quickMetaText}>{formatValue(recipe.readyInMinutes, ' dk')}</Text>
                  <Text style={styles.quickMetaDot}>•</Text>
                  <Text style={styles.quickMetaText}>{formatValue(recipe.servings, ' porsiyon')}</Text>
                </View>
              </View>

            </View>

            <View style={styles.metricsSection}>
              <Text style={styles.sectionEyebrow}>Besin Değerleri</Text>
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
                  <Text style={styles.metricLabel}>Yağ</Text>
                  <Text style={styles.metricValue}>{formatValue(recipe.nutrition?.fat, ' g')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>Malzemeler</Text>
              <Text style={styles.sectionTitle}>İçindekiler</Text>
              {recipe.ingredients.map((ingredient, index) => (
                <View key={`${recipe.id}-${ingredient.ingredientId}-${index}`} style={styles.listRow}>
                  <View style={styles.listBullet} />
                  <Text style={styles.sectionItem}>{formatIngredientLine(ingredient)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>Hazırlık</Text>
              <Text style={styles.sectionTitle}>Adımlar</Text>
              {recipe.steps.map((step) => (
                <View key={`${recipe.id}-step-${step.stepNumber}`} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step.stepNumber}</Text>
                  </View>
                  <Text style={styles.sectionItem}>{step.instruction}</Text>
                </View>
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
    backgroundColor: '#F5F5F7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
    paddingBottom: 36,
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
  detailLayout: {
    gap: 16,
  },
  heroImage: {
    width: '100%',
    height: 264,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
  },
  heroContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    padding: 20,
    gap: 12,
  },
  eyebrow: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  title: {
    color: '#111111',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryBadgeText: {
    color: '#6E6E73',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickMetaText: {
    color: '#6E6E73',
    fontSize: 13,
    fontWeight: '600',
  },
  quickMetaDot: {
    color: '#C7C7CC',
    fontSize: 13,
  },
  metricsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    padding: 18,
    gap: 12,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    minWidth: '47%',
    backgroundColor: '#F5F5F7',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 4,
  },
  metricLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  sectionEyebrow: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionItem: {
    flex: 1,
    color: '#3A3A3C',
    fontSize: 14,
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
    marginTop: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#1C1C1E',
    fontSize: 12,
    fontWeight: '700',
  },
});
