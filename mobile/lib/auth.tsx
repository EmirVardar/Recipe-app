import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AuthContextValue = {
  accessToken: string;
  fullName: string;
  isLoggedIn: boolean;
  setSession: (session: { accessToken: string; fullName: string }) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState('');
  const [fullName, setFullName] = useState('Community Member');

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      fullName,
      isLoggedIn: accessToken.length > 0,
      setSession: (session) => {
        setAccessToken(session.accessToken.trim());
        setFullName(session.fullName.trim() || 'Community Member');
      },
      clearSession: () => {
        setAccessToken('');
        setFullName('Community Member');
      },
    }),
    [accessToken, fullName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
