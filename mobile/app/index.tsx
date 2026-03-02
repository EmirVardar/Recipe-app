import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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

import {
  getOnboardingStatus,
  login,
  register,
  updateMedical,
  updateNutrition,
  updateProfile,
  type AuthResponse,
  type OnboardingStatusResponse,
} from '@/lib/api';

type AuthMode = 'login' | 'register';
type ScreenMode = 'auth' | 'onboarding' | 'done';

export default function HomeScreen() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('auth');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthResponse | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);

  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [goal, setGoal] = useState('');

  const [chronicConditions, setChronicConditions] = useState('none');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [intolerances, setIntolerances] = useState('');

  const [dietType, setDietType] = useState('');
  const [avoidFoods, setAvoidFoods] = useState('');
  const [preferredFoods, setPreferredFoods] = useState('');
  const [budgetLevel, setBudgetLevel] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / 3)).current;

  const authActionTitle = useMemo(
    () => (authMode === 'login' ? 'Giris Yap' : 'Kayit Ol'),
    [authMode]
  );
  const authSubtitle = useMemo(
    () => (authMode === 'login' ? 'Tekrar hos geldin' : 'Hesabini olustur'),
    [authMode]
  );

  const onboardingTitle = useMemo(() => {
    if (onboardingStep === 0) return 'Profil Bilgileri';
    if (onboardingStep === 1) return 'Medikal Bilgiler';
    return 'Beslenme Tercihleri';
  }, [onboardingStep]);

  const onSubmitAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      if (authMode === 'register' && !fullName.trim()) {
        throw new Error('Full name is required');
      }

      const authResult =
        authMode === 'login'
          ? await login({ email, password })
          : await register({ email, password, fullName });

      setCurrentUser(authResult);
      setAccessToken(authResult.accessToken);
      await refreshOnboarding(authResult.accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitOnboardingStep = async () => {
    if (!accessToken) {
      setError('Oturum suresi doldu. Lutfen tekrar giris yap.');
      setScreenMode('auth');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (onboardingStep === 0) {
        const parsedAge = Number(age);
        const parsedHeight = Number(heightCm);
        const parsedWeight = Number(weightKg);

        if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
          throw new Error('Yas 1 ile 120 arasinda olmali');
        }
        if (!sex.trim()) {
          throw new Error('Cinsiyet zorunlu');
        }
        if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
          throw new Error('Boy 0dan buyuk olmali');
        }
        if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
          throw new Error('Kilo 0dan buyuk olmali');
        }
        if (!goal.trim()) {
          throw new Error('Hedef zorunlu');
        }

        await updateProfile(accessToken, {
          age: parsedAge,
          sex,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
          activityLevel,
          goal,
        });
      } else if (onboardingStep === 1) {
        if (!chronicConditions.trim()) {
          throw new Error("Kronik hastalik bilgisi zorunlu (yoksa 'none' yazabilirsiniz)");
        }

        await updateMedical(accessToken, {
          chronicConditions,
          medications,
          allergies,
          intolerances,
        });
      } else {
        if (!dietType.trim()) {
          throw new Error('Beslenme tipi zorunlu');
        }

        await updateNutrition(accessToken, {
          dietType,
          avoidFoods,
          preferredFoods,
          budgetLevel,
        });
      }

      await refreshOnboarding(accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const refreshOnboarding = async (token: string) => {
    const status = await getOnboardingStatus(token);
    setOnboardingStatus(status);

    if (status.completed) {
      setScreenMode('done');
      return;
    }

    setOnboardingStep(getFirstIncompleteStep(status));
    setScreenMode('onboarding');
  };

  const onBackStep = () => {
    setOnboardingStep((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenMode, authMode, onboardingStep, contentAnim]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (onboardingStep + 1) / 3,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [onboardingStep, progressAnim]);

  const animatedContentStyle = {
    opacity: contentAnim,
    transform: [
      {
        translateY: contentAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>Yemek Oneri Asistani</Text>
            <Text style={styles.title}>ReciPulse</Text>
            <Text style={styles.sub}>
              {screenMode === 'auth' ? authSubtitle : 'Saglik yolculugunu kisilestir'}
            </Text>
          </View>

          {screenMode === 'auth' ? (
            <Animated.View style={animatedContentStyle}>
              <View style={styles.segment}>
                <Pressable
                  style={[styles.segmentButton, authMode === 'login' ? styles.segmentActive : null]}
                  onPress={() => setAuthMode('login')}>
                  <Text style={authMode === 'login' ? styles.segmentTextActive : styles.segmentText}>Giris</Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentButton, authMode === 'register' ? styles.segmentActive : null]}
                  onPress={() => setAuthMode('register')}>
                  <Text style={authMode === 'register' ? styles.segmentTextActive : styles.segmentText}>Kayit</Text>
                </Pressable>
              </View>

                <View style={styles.card}>
                <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" />
                <Field label="Sifre" value={password} onChangeText={setPassword} secureTextEntry />
                {authMode === 'register' ? (
                  <Field label="Ad Soyad" value={fullName} onChangeText={setFullName} />
                ) : null}

                <Pressable style={styles.submitButton} onPress={onSubmitAuth} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{authActionTitle}</Text>
                  )}
                </Pressable>
                </View>
            </Animated.View>
          ) : null}

          {screenMode === 'onboarding' ? (
            <Animated.View style={animatedContentStyle}>
              <View style={styles.progressCard}>
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressLabel}>Onboarding</Text>
                  <Text style={styles.progressLabel}>Adim {onboardingStep + 1}/3</Text>
                </View>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        transform: [{ scaleX: progressAnim }],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressTitle}>{onboardingTitle}</Text>
              </View>

              <View style={styles.card}>
                {onboardingStep === 0 ? (
                  <>
                    <Field label="Yas" value={age} onChangeText={setAge} keyboardType="number-pad" />
                    <Field label="Cinsiyet" value={sex} onChangeText={setSex} placeholder="erkek / kadin / diger" />
                    <Field
                      label="Boy (cm)"
                      value={heightCm}
                      onChangeText={setHeightCm}
                      keyboardType="decimal-pad"
                    />
                    <Field
                      label="Kilo (kg)"
                      value={weightKg}
                      onChangeText={setWeightKg}
                      keyboardType="decimal-pad"
                    />
                    <Field
                      label="Aktivite Seviyesi"
                      value={activityLevel}
                      onChangeText={setActivityLevel}
                      placeholder="dusuk / orta / yuksek"
                    />
                    <Field label="Hedef" value={goal} onChangeText={setGoal} placeholder="kilo_ver / koru" />
                  </>
                ) : null}

                {onboardingStep === 1 ? (
                  <>
                    <Field
                      label="Kronik Hastaliklar"
                      value={chronicConditions}
                      onChangeText={setChronicConditions}
                      placeholder="none / diyabet / hipertansiyon"
                    />
                    <Field label="Ilaclar" value={medications} onChangeText={setMedications} />
                    <Field label="Alerjiler" value={allergies} onChangeText={setAllergies} />
                    <Field label="Intoleranslar" value={intolerances} onChangeText={setIntolerances} />
                  </>
                ) : null}

                {onboardingStep === 2 ? (
                  <>
                    <Field
                      label="Beslenme Tipi"
                      value={dietType}
                      onChangeText={setDietType}
                      placeholder="omnivor / vejetaryen / vegan"
                    />
                    <Field label="Kacinilacak Besinler" value={avoidFoods} onChangeText={setAvoidFoods} />
                    <Field label="Tercih Edilen Besinler" value={preferredFoods} onChangeText={setPreferredFoods} />
                    <Field
                      label="Butce Seviyesi"
                      value={budgetLevel}
                      onChangeText={setBudgetLevel}
                      placeholder="dusuk / orta / yuksek"
                    />
                  </>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.secondaryButton, onboardingStep === 0 ? styles.disabledButton : null]}
                    onPress={onBackStep}
                    disabled={loading || onboardingStep === 0}>
                    <Text style={styles.secondaryButtonText}>Geri</Text>
                  </Pressable>

                  <Pressable style={styles.submitButtonInline} onPress={onSubmitOnboardingStep} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>{onboardingStep === 2 ? 'Kurulumu Bitir' : 'Devam Et'}</Text>
                    )}
                  </Pressable>
                </View>
                </View>
            </Animated.View>
          ) : null}

          {screenMode === 'done' ? (
            <Animated.View style={[styles.resultCard, animatedContentStyle]}>
              <Text style={styles.success}>Kurulum tamamlandi.</Text>
              <Text style={styles.body}>Hos geldin, {currentUser?.fullName ?? currentUser?.email ?? 'Kullanici'}.</Text>
              <Text style={styles.body}>Artik kisisellestirilmis oneri akisina gecis yapabilirsin.</Text>
              <Pressable style={styles.secondaryButton} onPress={() => setScreenMode('onboarding')}>
                <Text style={styles.secondaryButtonText}>Tercihleri Duzenle</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {onboardingStatus ? (
            <Text style={styles.statusFoot}>
              Profil: {onboardingStatus.profileCompleted ? 'tamam' : 'bekliyor'} | Medikal:{' '}
              {onboardingStatus.medicalCompleted ? 'tamam' : 'bekliyor'} | Beslenme:{' '}
              {onboardingStatus.nutritionCompleted ? 'tamam' : 'bekliyor'}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getFirstIncompleteStep(status: OnboardingStatusResponse): number {
  if (!status.profileCompleted) return 0;
  if (!status.medicalCompleted) return 1;
  if (!status.nutritionCompleted) return 2;
  return 2;
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad' | 'number-pad';
  placeholder?: string;
};

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  placeholder,
}: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
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
  progressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  progressTitle: {
    color: '#111827',
    fontSize: 18,
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
  submitButtonInline: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 14,
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
  statusFoot: {
    color: '#6b7280',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
