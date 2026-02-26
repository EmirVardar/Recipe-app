import { Platform } from 'react-native';

type PingResponse = {
  status: string;
  service: string;
  timestamp: string;
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

export async function pingBackend(): Promise<PingResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/ping`);

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  return (await response.json()) as PingResponse;
}
