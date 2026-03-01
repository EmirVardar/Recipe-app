import { Platform } from 'react-native';

export type AuthResponse = {
  id: number;
  email: string;
  fullName: string;
  heightCm: number;
  weightKg: number;
  accessToken: string;
  message: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  fullName: string;
  heightCm: number;
  weightKg: number;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type MeResponse = {
  authenticated: boolean;
  email: string;
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
