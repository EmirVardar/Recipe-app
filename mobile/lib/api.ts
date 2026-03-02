import { Platform } from 'react-native';

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

export type MedicalUpdateRequest = {
  chronicConditions: string;
  medications: string;
  allergies: string;
  intolerances: string;
};

export type NutritionUpdateRequest = {
  dietType: string;
  avoidFoods: string;
  preferredFoods: string;
  budgetLevel: string;
};

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

export async function updateMedical(accessToken: string, payload: MedicalUpdateRequest) {
  return request('/api/me/medical', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
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

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed with ${response.status}`;

    try {
      const errorData = (await response.json()) as { message?: string; error?: string; detail?: string };
      errorMessage = errorData.message ?? errorData.detail ?? errorData.error ?? errorMessage;
    } catch {
      // Keep fallback message when body is not JSON.
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}
