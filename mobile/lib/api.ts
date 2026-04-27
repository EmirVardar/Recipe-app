import { Platform } from 'react-native';
import type { RecipeFilters } from '@/components/recipe-filters';

export type AuthResponse = {
  id: number;
  email: string;
  fullName: string;
  accessToken: string;
  message: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  fullName: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type MeResponse = {
  authenticated: boolean;
  email: string;
};

export type OnboardingStatusResponse = {
  profileCompleted: boolean;
  medicalCompleted: boolean;
  nutritionCompleted: boolean;
  completed: boolean;
};

export type ProfileUpdateRequest = {
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: string;
};
export type ProfileResponse = {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goal: string | null;
};

export type MedicalUpdateRequest = {
  chronicConditions: string;
  medications: string;
  allergies: string;
  intolerances: string;
};
export type MedicalResponse = {
  chronicConditions: string | null;
  medications: string | null;
  allergies: string | null;
  intolerances: string | null;
};

export type NutritionUpdateRequest = {
  dietType: string;
  avoidFoods: string;
  preferredFoods: string;
  budgetLevel: string;
};
export type NutritionResponse = {
  dietType: string | null;
  avoidFoods: string | null;
  preferredFoods: string | null;
  budgetLevel: string | null;
};

export type RecipeListItemResponse = {
  id: number;
  title: string;
  image: string | null;
  primaryCategory: string;
  servings: number | null;
  readyInMinutes: number | null;
  calories: number | null;
  favorited: boolean;
};

export type RecipeNutritionInfo = {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

export type RecipeIngredientInfo = {
  ingredientId: number;
  spoonacularId: number | null;
  name: string;
  originalName: string | null;
  image: string | null;
  amount: number | null;
  unit: string | null;
  consistency: string | null;
  aisle: string | null;
  originalText: string | null;
};

export type RecipeStepInfo = {
  stepNumber: number;
  instruction: string;
};

export type RecipeTagInfo = {
  tagType: string;
  tagValue: string;
};

export type RecipeDetailResponse = {
  id: number;
  spoonacularId: number;
  title: string;
  image: string | null;
  primaryCategory: string;
  summary: string | null;
  instructions: string | null;
  servings: number | null;
  readyInMinutes: number | null;
  sourceUrl: string | null;
  spoonacularSourceUrl: string | null;
  healthScore: number | null;
  pricePerServing: number | null;
  vegetarian: boolean | null;
  vegan: boolean | null;
  glutenFree: boolean | null;
  dairyFree: boolean | null;
  veryHealthy: boolean | null;
  cheap: boolean | null;
  veryPopular: boolean | null;
  sustainable: boolean | null;
  lowFodmap: boolean | null;
  nutrition: RecipeNutritionInfo | null;
  ingredients: RecipeIngredientInfo[];
  steps: RecipeStepInfo[];
  tags: RecipeTagInfo[];
};

export type AssistantChatResponse = {
  answer: string;
  warnings: string[];
  suggestions: string[];
};

export type HealthTransferResponse = {
  success: boolean;
  id: number;
  adim: number;
  kalori: number;
  createdAt: string;
  message: string;
};

export type FoodProductSearchItemResponse = {
  id: number;
  fdcId: number;
  name: string;
  defaultGramWeight: number | null;
  pieceGramWeight: number | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
};

export type MealLogItemCreateRequest = {
  logDate?: string;
  mealType: string;
  foodProductId: number;
  quantity: number;
  unitType: string;
};

export type RecipeMealLogItemCreateRequest = {
  logDate?: string;
  mealType: string;
  recipeId: number;
  servings: number;
};

export type MealLogItemResponse = {
  id: number;
  foodProductId: number | null;
  foodName: string | null;
  sourceId: number | null;
  sourceName: string | null;
  sourceType: 'FOOD' | 'RECIPE' | 'UNKNOWN';
  quantity: number;
  unitType: string;
  gramEquivalent: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MealLogResponse = {
  id: number;
  mealType: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: MealLogItemResponse[];
};

export type DailyMealLogsResponse = {
  logDate: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: MealLogResponse[];
};

function buildRecipeQueryParams(query?: string, filters?: RecipeFilters): string {
  const params = new URLSearchParams();
  const safeValue = (value: string | null | undefined) => (value ?? '').trim();

  if (safeValue(query).length > 0) {
    params.set('q', safeValue(query));
  }

  if (filters) {
    if (safeValue(filters.category).length > 0) {
      params.set('category', safeValue(filters.category));
    }
    if (safeValue(filters.minCalories).length > 0) {
      params.set('minCalories', safeValue(filters.minCalories));
    }
    if (safeValue(filters.maxCalories).length > 0) {
      params.set('maxCalories', safeValue(filters.maxCalories));
    }
    if (filters.highProtein) {
      params.set('highProtein', 'true');
    }
    if (filters.shortTime) {
      params.set('maxReadyInMinutes', '30');
    }
    if (filters.vegetarian) {
      params.set('vegetarian', 'true');
    }
    if (filters.vegan) {
      params.set('vegan', 'true');
    }
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8080';
  }

  return 'http://localhost:8080';
}

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe(accessToken: string): Promise<MeResponse> {
  return request<MeResponse>('/api/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getOnboardingStatus(accessToken: string): Promise<OnboardingStatusResponse> {
  return request<OnboardingStatusResponse>('/api/onboarding/status', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function updateProfile(accessToken: string, payload: ProfileUpdateRequest) {
  return request('/api/me/profile', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function getProfile(accessToken: string): Promise<ProfileResponse> {
  return request<ProfileResponse>('/api/me/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function updateMedical(accessToken: string, payload: MedicalUpdateRequest) {
  return request('/api/me/medical', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function getMedical(accessToken: string): Promise<MedicalResponse> {
  return request<MedicalResponse>('/api/me/medical', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function updateNutrition(accessToken: string, payload: NutritionUpdateRequest) {
  return request('/api/me/nutrition', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function getNutrition(accessToken: string): Promise<NutritionResponse> {
  return request<NutritionResponse>('/api/me/nutrition', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getRecipes(accessToken: string, filters?: RecipeFilters): Promise<RecipeListItemResponse[]> {
  return request<RecipeListItemResponse[]>(`/api/recipes${buildRecipeQueryParams(undefined, filters)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getFavoriteRecipes(accessToken: string): Promise<RecipeListItemResponse[]> {
  return request<RecipeListItemResponse[]>('/api/recipes/favorites', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function searchRecipes(
  accessToken: string,
  query: string,
  filters?: RecipeFilters
): Promise<RecipeListItemResponse[]> {
  return request<RecipeListItemResponse[]>(`/api/recipes${buildRecipeQueryParams(query, filters)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function addFavoriteRecipe(accessToken: string, recipeId: number) {
  return request<{ recipeId: number; favorited: boolean }>(`/api/recipes/favorites/${recipeId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function removeFavoriteRecipe(accessToken: string, recipeId: number) {
  return request<{ recipeId: number; favorited: boolean }>(`/api/recipes/favorites/${recipeId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getRecipeDetail(accessToken: string, recipeId: number): Promise<RecipeDetailResponse> {
  return request<RecipeDetailResponse>(`/api/recipes/${recipeId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function chatWithAssistant(accessToken: string, message: string): Promise<AssistantChatResponse> {
  return request<AssistantChatResponse>('/api/assistant/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  });
}

export async function getHealthTransferRecords(): Promise<HealthTransferResponse[]> {
  return request<HealthTransferResponse[]>('/api/saglik/kayitlar', {
    method: 'GET',
  });
}

export async function searchFoodProducts(
  query: string,
  limit = 12
): Promise<FoodProductSearchItemResponse[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  return request<FoodProductSearchItemResponse[]>(`/api/foods?${params.toString()}`, {
    method: 'GET',
  });
}

export async function getDailyMeals(
  accessToken: string,
  date?: string
): Promise<DailyMealLogsResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<DailyMealLogsResponse>(`/api/meals${query}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function addMealItem(accessToken: string, payload: MealLogItemCreateRequest) {
  return request<MealLogItemResponse>('/api/meals/items', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function addRecipeMealItem(accessToken: string, payload: RecipeMealLogItemCreateRequest) {
  return request<MealLogItemResponse>('/api/meals/items/recipe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateMealItem(accessToken: string, itemId: number, payload: MealLogItemCreateRequest) {
  return request<MealLogItemResponse>(`/api/meals/items/${itemId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateRecipeMealItem(
  accessToken: string,
  itemId: number,
  payload: RecipeMealLogItemCreateRequest
) {
  return request<MealLogItemResponse>(`/api/meals/items/${itemId}/recipe`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteMealItem(accessToken: string, itemId: number) {
  return request<void>(`/api/meals/items/${itemId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Istek ${response.status} kodu ile basarisiz oldu`;

    try {
      const errorData = (await response.json()) as { message?: string; error?: string; detail?: string };
      errorMessage = errorData.message ?? errorData.detail ?? errorData.error ?? errorMessage;
    } catch {
      // Keep fallback message when body is not JSON.
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}
