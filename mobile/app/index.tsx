import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function IndexRedirect() {
  const { isLoggedIn } = useAuth();

  return <Redirect href={isLoggedIn ? '/(tabs)' : '/auth'} />;
}
