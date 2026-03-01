import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMe, login, register, type AuthResponse } from '@/lib/api';

type AuthMode = 'login' | 'register';

export default function HomeScreen() {
  const [mode, setMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuthResponse | null>(null);
  const [meResult, setMeResult] = useState<string | null>(null);

  const actionTitle = useMemo(() => (mode === 'login' ? 'Sign In' : 'Create Account'), [mode]);
  const modeSubtitle = useMemo(
    () => (mode === 'login' ? 'Welcome back' : 'Create your account'),
    [mode]
  );

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    setMeResult(null);

    try {
      if (mode === 'login') {
        const data = await login({ email, password });
        setResult(data);
      } else {
        const parsedHeight = Number(heightCm);
        const parsedWeight = Number(weightKg);

        if (!fullName.trim()) {
          throw new Error('Full name is required');
        }

        if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
          throw new Error('Height must be a positive number');
        }

        if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
          throw new Error('Weight must be a positive number');
        }

        const data = await register({
          email,
          password,
          fullName,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
        });
        setResult(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const onPressMe = async () => {
    if (!result?.accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const me = await getMe(result.accessToken);
      setMeResult(`authenticated=${me.authenticated}, email=${me.email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>Recipe Reimagined</Text>
            <Text style={styles.title}>ReciPulse</Text>
            <Text style={styles.sub}>{modeSubtitle}</Text>
          </View>

          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentButton, mode === 'login' ? styles.segmentActive : null]}
              onPress={() => setMode('login')}>
              <Text style={mode === 'login' ? styles.segmentTextActive : styles.segmentText}>Login</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentButton, mode === 'register' ? styles.segmentActive : null]}
              onPress={() => setMode('register')}>
              <Text style={mode === 'register' ? styles.segmentTextActive : styles.segmentText}>Register</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />

            {mode === 'register' ? (
              <>
                <Field label="Full Name" value={fullName} onChangeText={setFullName} />
                <Field label="Height (cm)" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
                <Field label="Weight (kg)" value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />
              </>
            ) : null}

            <Pressable style={styles.submitButton} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{actionTitle}</Text>}
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          {result ? (
            <View style={styles.resultCard}>
              <Text style={styles.success}>{result.message}</Text>
              <Text style={styles.body}>User: {result.fullName} ({result.email})</Text>
              <Text style={styles.token}>Token: {result.accessToken.slice(0, 36)}...</Text>

              <Pressable style={styles.secondaryButton} onPress={onPressMe} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Test /api/me</Text>
              </Pressable>

              {meResult ? <Text style={styles.body}>{meResult}</Text> : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
};

function Field({ label, value, onChangeText, secureTextEntry, keyboardType = 'default' }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        keyboardType={keyboardType}
        style={styles.input}
        placeholderTextColor="#9ca3af"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  titleWrap: {
    gap: 4,
  },
  eyebrow: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    color: '#111827',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
  },
  sub: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
  },
  segment: {
    backgroundColor: '#e5e7eb',
    borderRadius: 14,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  segmentText: {
    color: '#6b7280',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#374151',
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 18,
  },
  success: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 10,
  },
  body: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
  },
  token: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryButton: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
});
