import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import HealthKit, { BiologicalSex } from '@kingstinct/react-native-healthkit';

import { getMedical, getNutrition, getProfile, updateMedical, updateNutrition, updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type ProfileFormState = {
  birthDate: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  goal: string;
};

type NutritionFormState = {
  dietType: string;
  avoidFoods: string;
  preferredFoods: string;
  budgetLevel: string;
};
type MedicalFormState = {
  chronicConditions: string;
  medications: string;
  allergies: string;
  intolerances: string;
};

type DetailPanel = 'editProfile' | 'foodPreferences';
type Choice = { label: string; value: string };

const SEX_OPTIONS: Choice[] = [
  { label: 'Erkek', value: 'ERKEK' },
  { label: 'Kadin', value: 'KADIN' },
  { label: 'Diger', value: 'DIGER' },
];

const ACTIVITY_OPTIONS: Choice[] = [
  { label: 'Dusuk', value: 'DUSUK' },
  { label: 'Orta', value: 'ORTA' },
  { label: 'Yuksek', value: 'YUKSEK' },
];

const GOAL_OPTIONS: Choice[] = [
  { label: 'Kilo ver', value: 'KILO_VER' },
  { label: 'Kilo al', value: 'KILO_AL' },
  { label: 'Koru', value: 'KORU' },
];

const DIET_OPTIONS: Choice[] = [
  { label: 'Omnivor', value: 'OMNIVORE' },
  { label: 'Vejetaryen', value: 'VEJETARYEN' },
  { label: 'Vegan', value: 'VEGAN' },
  { label: 'Keto', value: 'KETO' },
  { label: 'Akdeniz', value: 'AKDENIZ' },
  { label: 'Paleo', value: 'PALEO' },
];

const BUDGET_OPTIONS: Choice[] = [
  { label: 'Dusuk', value: 'DUSUK' },
  { label: 'Orta', value: 'ORTA' },
  { label: 'Yuksek', value: 'YUKSEK' },
];

const CHRONIC_OPTIONS: string[] = ['Diyabet', 'Hipertansiyon', 'Kolesterol', 'Kalp', 'Tiroid', 'Yok'];
const ALLERGY_OPTIONS: string[] = ['Gluten', 'Yumurta', 'Deniz urunu', 'Yer fistigi', 'Soya', 'Yok'];
const INTOLERANCE_OPTIONS: string[] = ['Laktoz', 'Gluten', 'Fruktoz', 'Histamin', 'Yok'];

export default function ProfileTabScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { accessToken, fullName, isLoggedIn } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);
  const [prefillingHealthProfile, setPrefillingHealthProfile] = useState(false);
  const [prefillDone, setPrefillDone] = useState(false);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>('editProfile');
  const panelTranslateX = useRef(new Animated.Value(0)).current;
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    birthDate: '',
    sex: '',
    heightCm: '',
    weightKg: '',
    activityLevel: '',
    goal: '',
  });

  const [nutritionForm, setNutritionForm] = useState<NutritionFormState>({
    dietType: '',
    avoidFoods: '',
    preferredFoods: '',
    budgetLevel: '',
  });
  const [medicalForm, setMedicalForm] = useState<MedicalFormState>({
    chronicConditions: '',
    medications: '',
    allergies: '',
    intolerances: '',
  });
  const [selectedChronic, setSelectedChronic] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedIntolerances, setSelectedIntolerances] = useState<string[]>([]);
  const [customChronic, setCustomChronic] = useState('');
  const [customAllergies, setCustomAllergies] = useState('');
  const [customIntolerances, setCustomIntolerances] = useState('');

  const initials = useMemo(() => {
    const safeName = fullName.trim();
    return safeName.length > 0 ? safeName[0].toUpperCase() : 'U';
  }, [fullName]);
  const isSavingDetail = detailPanel === 'editProfile' ? savingProfile : savingMedical || savingNutrition;

  const splitCsv = (raw: string): string[] =>
    raw
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

  const composeCsv = (selected: string[], custom: string): string => {
    const merged = [...selected, ...splitCsv(custom)];
    return Array.from(new Set(merged)).join(', ');
  };

  const normalizeEnumValue = (raw: string | null): string => {
    if (!raw) {
      return '';
    }
    return raw
      .trim()
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'O')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .replace(/-/g, '_')
      .replace(/\s+/g, '_')
      .toUpperCase();
  };

  const formatDateInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatMetricInput = (value: number, digits = 1): string => {
    if (!Number.isFinite(value)) {
      return '';
    }

    const rounded = Number(value.toFixed(digits));
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };

  const mapBiologicalSexToProfileValue = (biologicalSex: number): string => {
    if (biologicalSex === BiologicalSex.male) {
      return 'ERKEK';
    }
    if (biologicalSex === BiologicalSex.female) {
      return 'KADIN';
    }
    if (biologicalSex === BiologicalSex.other) {
      return 'DIGER';
    }
    return '';
  };

  const toggleMulti = (value: string, setSelected: (updater: (prev: string[]) => string[]) => void) => {
    setSelected((prev) => {
      if (value === 'Yok') {
        return prev.includes('Yok') ? [] : ['Yok'];
      }
      const withoutNone = prev.filter((x) => x !== 'Yok');
      return withoutNone.includes(value) ? withoutNone.filter((x) => x !== value) : [...withoutNone, value];
    });
  };

  useEffect(() => {
    const loadSavedValues = async () => {
      if (!accessToken || prefillDone) {
        return;
      }

      try {
        const [profile, medical, nutrition] = await Promise.all([
          getProfile(accessToken),
          getMedical(accessToken),
          getNutrition(accessToken),
        ]);

        setProfileForm({
          birthDate: profile.birthDate ?? '',
          sex: normalizeEnumValue(profile.sex),
          heightCm: profile.heightCm != null ? String(profile.heightCm) : '',
          weightKg: profile.weightKg != null ? String(profile.weightKg) : '',
          activityLevel: normalizeEnumValue(profile.activityLevel),
          goal: normalizeEnumValue(profile.goal),
        });

        setMedicalForm({
          chronicConditions: medical.chronicConditions ?? '',
          medications: medical.medications ?? '',
          allergies: medical.allergies ?? '',
          intolerances: medical.intolerances ?? '',
        });

        const chronicList = splitCsv(medical.chronicConditions ?? '');
        setSelectedChronic(chronicList.filter((x) => CHRONIC_OPTIONS.includes(x)));
        setCustomChronic(chronicList.filter((x) => !CHRONIC_OPTIONS.includes(x)).join(', '));

        const allergyList = splitCsv(medical.allergies ?? '');
        setSelectedAllergies(allergyList.filter((x) => ALLERGY_OPTIONS.includes(x)));
        setCustomAllergies(allergyList.filter((x) => !ALLERGY_OPTIONS.includes(x)).join(', '));

        const intoleranceList = splitCsv(medical.intolerances ?? '');
        setSelectedIntolerances(intoleranceList.filter((x) => INTOLERANCE_OPTIONS.includes(x)));
        setCustomIntolerances(intoleranceList.filter((x) => !INTOLERANCE_OPTIONS.includes(x)).join(', '));

        setNutritionForm({
          dietType: normalizeEnumValue(nutrition.dietType),
          avoidFoods: nutrition.avoidFoods ?? '',
          preferredFoods: nutrition.preferredFoods ?? '',
          budgetLevel: normalizeEnumValue(nutrition.budgetLevel),
        });
      } catch {
        // Prefill is best-effort; keep empty fields if no saved data exists yet.
      } finally {
        setPrefillDone(true);
      }
    };

    void loadSavedValues();
  }, [accessToken, prefillDone]);

  const onSaveProfile = async () => {
    const birthDate = profileForm.birthDate.trim();
    const heightCm = Number(profileForm.heightCm);
    const weightKg = Number(profileForm.weightKg);

    if (!birthDate || !heightCm || !weightKg || !profileForm.sex || !profileForm.activityLevel || !profileForm.goal) {
      Alert.alert('Eksik bilgi', 'Lutfen tum profile alanlarini doldur.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      Alert.alert('Gecersiz tarih', 'Dogum tarihini YYYY-AA-GG formatinda gir.');
      return;
    }

    if (!accessToken) {
      Alert.alert('Giris gerekli', 'Profil bilgilerini kaydetmek icin once giris yap.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(accessToken, {
        birthDate,
        sex: profileForm.sex,
        heightCm,
        weightKg,
        activityLevel: profileForm.activityLevel,
        goal: profileForm.goal,
      });
      Alert.alert('Basarili', 'Profil bilgileri guncellendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert('Kaydetme hatasi', message);
    } finally {
      setSavingProfile(false);
    }
  };

  const onPrefillProfileFromHealth = async () => {
    if (prefillingHealthProfile) {
      return;
    }

    setPrefillingHealthProfile(true);

    try {
      const isAvailable = await HealthKit.isHealthDataAvailable();
      if (!isAvailable) {
        Alert.alert('Kullanilamiyor', 'Apple Saglik bu cihazda kullanilamiyor.');
        return;
      }

      await HealthKit.requestAuthorization({
        toRead: [
          'HKCharacteristicTypeIdentifierDateOfBirth',
          'HKCharacteristicTypeIdentifierBiologicalSex',
          'HKQuantityTypeIdentifierHeight',
          'HKQuantityTypeIdentifierBodyMass',
        ],
      });

      const [birthDate, biologicalSex, heightSample, weightSample] = await Promise.all([
        HealthKit.getDateOfBirthAsync(),
        HealthKit.getBiologicalSexAsync(),
        HealthKit.getMostRecentQuantitySample('HKQuantityTypeIdentifierHeight', 'm'),
        HealthKit.getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg'),
      ]);

      const nextBirthDate = birthDate ? formatDateInput(birthDate) : '';
      const nextSex = mapBiologicalSexToProfileValue(biologicalSex);
      const nextHeightCm = heightSample ? formatMetricInput(heightSample.quantity * 100) : '';
      const nextWeightKg = weightSample ? formatMetricInput(weightSample.quantity) : '';

      if (!nextBirthDate && !nextSex && !nextHeightCm && !nextWeightKg) {
        Alert.alert('Veri bulunamadi', 'Apple Saglik icinde doldurulacak profil verisi bulunamadi.');
        return;
      }

      setProfileForm((prev) => ({
        ...prev,
        birthDate: nextBirthDate || prev.birthDate,
        sex: nextSex || prev.sex,
        heightCm: nextHeightCm || prev.heightCm,
        weightKg: nextWeightKg || prev.weightKg,
      }));

      Alert.alert('Hazir', 'Bulunan Apple Saglik verileri profile dolduruldu. Kontrol edip kaydedebilirsin.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apple Saglik verileri okunamadi.';
      Alert.alert('Apple Saglik hatasi', message);
    } finally {
      setPrefillingHealthProfile(false);
    }
  };

  const onSaveFoodPreferences = async () => {
    if (!accessToken) {
      Alert.alert('Giris gerekli', 'Tercihleri kaydetmek icin once giris yap.');
      return;
    }
    if (!nutritionForm.dietType || !nutritionForm.budgetLevel) {
      Alert.alert('Eksik bilgi', 'En az diyet tipi ve butce seviyesi gir.');
      return;
    }

    const chronicConditions = composeCsv(selectedChronic, customChronic);
    const allergies = composeCsv(selectedAllergies, customAllergies);
    const intolerances = composeCsv(selectedIntolerances, customIntolerances);

    if (!chronicConditions) {
      Alert.alert('Eksik bilgi', 'En az bir kronik durum sec veya "Yok" sec.');
      return;
    }

    setSavingMedical(true);
    setSavingNutrition(true);
    try {
      await Promise.all([
        updateMedical(accessToken, {
          chronicConditions,
          medications: medicalForm.medications,
          allergies,
          intolerances,
        }),
        updateNutrition(accessToken, nutritionForm),
      ]);
      Alert.alert('Basarili', 'Saglik ve beslenme tercihleri kaydedildi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert('Kaydetme hatasi', message);
    } finally {
      setSavingMedical(false);
      setSavingNutrition(false);
    }
  };

  const openFoodPreferencesPanel = () => {
    setDetailPanel('foodPreferences');
    Animated.timing(panelTranslateX, {
      toValue: -screenWidth,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const openEditProfilePanel = () => {
    setDetailPanel('editProfile');
    Animated.timing(panelTranslateX, {
      toValue: -screenWidth,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const closeFoodPreferencesPanel = () => {
    Animated.timing(panelTranslateX, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  if (!isLoggedIn) {
    return <Redirect href="/auth" />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.profilePanelsViewport}>
        <Animated.View
          style={[
            styles.profilePanelsTrack,
            {
              width: screenWidth * 2,
              transform: [{ translateX: panelTranslateX }],
            },
          ]}>
          <ScrollView style={{ width: screenWidth }} contentContainerStyle={styles.content}>
            <Text style={styles.pageEyebrow}>Hesabın</Text>
            <Text style={styles.pageTitle}>Profil</Text>

            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.profileMeta}>
                <Text style={styles.fullName}>{fullName}</Text>
                <Text style={styles.subTitle}>Topluluk üyesi</Text>

                <Pressable style={styles.outlineButton} onPress={openEditProfilePanel}>
                  <Text style={styles.outlineButtonText}>Profili düzenle</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hesap Yönetimi</Text>
              <Pressable style={styles.managementRow} onPress={openFoodPreferencesPanel}>
                <Ionicons name="heart-outline" size={22} color="#1C1C1E" />
                <View style={styles.managementTextWrap}>
                  <Text style={styles.managementTitle}>Beslenme Tercihleri</Text>
                  <Text style={styles.managementSubtitle}>Sadece Senin İçin sekmesi için geçerlidir</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
              </Pressable>
            </View>
          </ScrollView>

          <ScrollView style={{ width: screenWidth }} contentContainerStyle={styles.content}>
            <View style={styles.preferenceHeader}>
              <Pressable onPress={closeFoodPreferencesPanel}>
                <Ionicons name="chevron-back" size={30} color="#111827" />
              </Pressable>
                <Text style={styles.preferenceTitle}>
                {detailPanel === 'editProfile' ? 'Profili Düzenle' : 'Beslenme Tercihleri'}
              </Text>
              <Pressable
                onPress={detailPanel === 'editProfile' ? onSaveProfile : onSaveFoodPreferences}
                disabled={isSavingDetail}>
                <Text style={styles.preferenceSaveText}>{isSavingDetail ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </Pressable>
            </View>

            {detailPanel === 'editProfile' ? (
              <View style={styles.detailPanelBody}>
                <View style={styles.editAvatarWrap}>
                  <View style={styles.editAvatar}>
                    <Text style={styles.editAvatarText}>{initials}</Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.healthPrefillButton, prefillingHealthProfile ? styles.healthPrefillButtonDisabled : null]}
                  onPress={onPrefillProfileFromHealth}
                  disabled={prefillingHealthProfile}>
                  <Ionicons name="heart-outline" size={18} color="#065F46" />
                  <Text style={styles.healthPrefillButtonText}>
                    {prefillingHealthProfile ? 'Apple Sağlık okunuyor...' : "Apple Sağlık'tan doldur"}
                  </Text>
                </Pressable>

                <Text style={styles.fieldLabel}>Doğum tarihi</Text>
                <TextInput
                  value={profileForm.birthDate}
                  onChangeText={(value) => setProfileForm((prev) => ({ ...prev, birthDate: value }))}
                  keyboardType="numbers-and-punctuation"
                  placeholder="YYYY-AA-GG"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Cinsiyet</Text>
                <View style={styles.chipsWrap}>
                  {SEX_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, profileForm.sex === opt.value ? styles.chipActive : null]}
                      onPress={() => setProfileForm((prev) => ({ ...prev, sex: opt.value }))}>
                      <Text style={[styles.chipText, profileForm.sex === opt.value ? styles.chipTextActive : null]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Boy (cm)</Text>
                <TextInput
                  value={profileForm.heightCm}
                  onChangeText={(value) => setProfileForm((prev) => ({ ...prev, heightCm: value }))}
                  keyboardType="number-pad"
                  placeholder="Boy (cm)"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Kilo (kg)</Text>
                <TextInput
                  value={profileForm.weightKg}
                  onChangeText={(value) => setProfileForm((prev) => ({ ...prev, weightKg: value }))}
                  keyboardType="number-pad"
                  placeholder="Kilo (kg)"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Aktivite seviyesi</Text>
                <View style={styles.chipsWrap}>
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, profileForm.activityLevel === opt.value ? styles.chipActive : null]}
                      onPress={() => setProfileForm((prev) => ({ ...prev, activityLevel: opt.value }))}>
                      <Text
                        style={[
                          styles.chipText,
                          profileForm.activityLevel === opt.value ? styles.chipTextActive : null,
                        ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Hedef</Text>
                <View style={styles.chipsWrap}>
                  {GOAL_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, profileForm.goal === opt.value ? styles.chipActive : null]}
                      onPress={() => setProfileForm((prev) => ({ ...prev, goal: opt.value }))}>
                      <Text style={[styles.chipText, profileForm.goal === opt.value ? styles.chipTextActive : null]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.detailPanelBody}>
                  <Text style={styles.sectionTitle}>Tıbbi Bilgiler</Text>
                  <Text style={styles.itemHint}>Güvenlik filtreleri için sağlık bilgileri.</Text>

                  <Text style={styles.fieldLabel}>Kronik rahatsızlıklar</Text>
                  <View style={styles.chipsWrap}>
                    {CHRONIC_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt}
                        style={[styles.chip, selectedChronic.includes(opt) ? styles.chipActive : null]}
                        onPress={() => toggleMulti(opt, setSelectedChronic)}>
                        <Text style={[styles.chipText, selectedChronic.includes(opt) ? styles.chipTextActive : null]}>
                          {opt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={customChronic}
                    onChangeText={setCustomChronic}
                    placeholder="Diğer kronik durumlar (virgülle ayır)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>İlaçlar</Text>
                  <TextInput
                    value={medicalForm.medications}
                    onChangeText={(value) => setMedicalForm((prev) => ({ ...prev, medications: value }))}
                    placeholder="İlaçlar"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>Alerjiler</Text>
                  <View style={styles.chipsWrap}>
                    {ALLERGY_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt}
                        style={[styles.chip, selectedAllergies.includes(opt) ? styles.chipActive : null]}
                        onPress={() => toggleMulti(opt, setSelectedAllergies)}>
                        <Text
                          style={[styles.chipText, selectedAllergies.includes(opt) ? styles.chipTextActive : null]}>
                          {opt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={customAllergies}
                    onChangeText={setCustomAllergies}
                    placeholder="Diğer alerjiler (virgülle ayır)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>Intoleranslar</Text>
                  <View style={styles.chipsWrap}>
                    {INTOLERANCE_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt}
                        style={[styles.chip, selectedIntolerances.includes(opt) ? styles.chipActive : null]}
                        onPress={() => toggleMulti(opt, setSelectedIntolerances)}>
                        <Text
                          style={[
                            styles.chipText,
                            selectedIntolerances.includes(opt) ? styles.chipTextActive : null,
                          ]}>
                          {opt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={customIntolerances}
                    onChangeText={setCustomIntolerances}
                    placeholder="Diğer intoleranslar (virgülle ayır)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.detailPanelBody, { marginTop: 12 }]}>
                  <Text style={styles.sectionTitle}>Beslenme Tercihleri</Text>
                  <Text style={styles.itemHint}>Sadece Senin İçin sekmesi için geçerlidir</Text>

                  <Text style={styles.fieldLabel}>Diyet tipi</Text>
                  <View style={styles.chipsWrap}>
                    {DIET_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.chip, nutritionForm.dietType === opt.value ? styles.chipActive : null]}
                        onPress={() => setNutritionForm((prev) => ({ ...prev, dietType: opt.value }))}>
                        <Text
                          style={[styles.chipText, nutritionForm.dietType === opt.value ? styles.chipTextActive : null]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>Kaçınılacak yiyecekler</Text>
                  <TextInput
                    value={nutritionForm.avoidFoods}
                    onChangeText={(value) => setNutritionForm((prev) => ({ ...prev, avoidFoods: value }))}
                    placeholder="Kaçınılacak yiyecekler (virgülle ayır)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>Tercih edilen yiyecekler</Text>
                  <TextInput
                    value={nutritionForm.preferredFoods}
                    onChangeText={(value) => setNutritionForm((prev) => ({ ...prev, preferredFoods: value }))}
                    placeholder="Tercih edilen yiyecekler (virgülle ayır)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>Bütçe seviyesi</Text>
                  <View style={styles.chipsWrap}>
                    {BUDGET_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.chip, nutritionForm.budgetLevel === opt.value ? styles.chipActive : null]}
                        onPress={() => setNutritionForm((prev) => ({ ...prev, budgetLevel: opt.value }))}>
                        <Text
                          style={[
                            styles.chipText,
                            nutritionForm.budgetLevel === opt.value ? styles.chipTextActive : null,
                          ]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
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
    paddingBottom: 32,
  },
  profilePanelsViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  profilePanelsTrack: {
    flexDirection: 'row',
    flex: 1,
  },
  pageEyebrow: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'center',
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#F0F0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
  },
  profileMeta: {
    flex: 1,
    gap: 5,
  },
  fullName: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: '#111111',
  },
  subTitle: {
    fontSize: 13,
    color: '#6E6E73',
    marginBottom: 6,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  outlineButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  section: {
    marginBottom: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: '#3A3A3C',
  },
  rowValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  managementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  managementTextWrap: {
    flex: 1,
  },
  managementTitle: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  managementSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6E6E73',
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
  },
  preferenceTitle: {
    fontSize: 18,
    color: '#111111',
    fontWeight: '700',
  },
  preferenceSaveText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '700',
  },
  detailPanelBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  formCard: {
    backgroundColor: '#FFF1E6',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  itemHint: {
    fontSize: 12,
    color: '#6E6E73',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111111',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 5,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#1C1C1E',
    backgroundColor: '#1C1C1E',
  },
  chipText: {
    fontSize: 12,
    color: '#3A3A3C',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  editAvatarWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  editAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#F0F0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111111',
  },
  healthPrefillButton: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  healthPrefillButtonDisabled: {
    opacity: 0.7,
  },
  healthPrefillButtonText: {
    color: '#1C1C1E',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: '#1C1C1E',
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loggedOutContent: {
    flex: 1,
    paddingBottom: 10,
  },
  collageWrap: {
    height: 250,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  collageFade1: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 52,
    backgroundColor: 'rgba(248,250,252,0.45)',
  },
  collageFade2: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 36,
    backgroundColor: 'rgba(248,250,252,0.7)',
  },
  collageFade3: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
    backgroundColor: 'rgba(248,250,252,0.92)',
  },
  collageCloseButton: {
    position: 'absolute',
    top: 18,
    right: 22,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authHeroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  authHeroSub: {
    textAlign: 'center',
    color: '#111827',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 12,
  },
  socialButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#0F766E',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  orLineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 10,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D5DB',
  },
  orText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 20,
  },
  authPrimaryButton: {
    marginHorizontal: 22,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  authPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
  },
  authTerms: {
    marginTop: 10,
    textAlign: 'center',
    color: '#3F3F46',
    fontSize: 12,
    paddingHorizontal: 22,
    lineHeight: 18,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  bottomSwitchWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  bottomSwitchWrapLarge: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 26,
  },
  bottomSwitchText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 6,
  },
  bottomSwitchLink: {
    fontSize: 14,
    color: '#F97316',
  },
  authFormWrap: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  authTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 42,
  },
  authTopTitle: {
    fontSize: 20,
    color: '#111827',
    fontWeight: '500',
  },
  authSkip: {
    fontSize: 14,
    color: '#3F3F46',
  },
  authInput: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    height: 64,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  authInputWithIcon: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    height: 64,
    paddingLeft: 20,
    paddingRight: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  authInputInner: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  forgotPass: {
    color: '#F97316',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 22,
  },
});
