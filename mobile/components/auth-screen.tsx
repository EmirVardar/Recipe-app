import { useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { login, register } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type AuthMode = 'getStarted' | 'login' | 'register';

export default function AuthScreen() {
  const { setSession } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('getStarted');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const onLogin = async () => {
    if (!authEmail || !authPassword) {
      Alert.alert('Eksik bilgi', 'Email ve sifre gir.');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await login({ email: authEmail.trim(), password: authPassword });
      setSession({ accessToken: response.accessToken, fullName: response.fullName || 'Community Member' });
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert('Giris hatasi', message);
    } finally {
      setAuthLoading(false);
    }
  };

  const onRegister = async () => {
    if (!registerName || !authEmail || !authPassword) {
      Alert.alert('Eksik bilgi', 'Kayit icin ad, e-posta ve sifre gerekli.');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await register({
        fullName: registerName.trim(),
        email: authEmail.trim(),
        password: authPassword,
      });
      setSession({ accessToken: response.accessToken, fullName: response.fullName || registerName.trim() });
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert('Kayit hatasi', message);
    } finally {
      setAuthLoading(false);
    }
  };

  const renderGetStarted = () => (
    <View style={styles.loggedOutContent}>
      <View style={styles.collageWrap}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1400&q=80' }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.collageFade1} />
        <View style={styles.collageFade2} />
        <View style={styles.collageFade3} />
        <Pressable style={styles.collageCloseButton} onPress={() => setAuthMode('login')}>
          <Ionicons name="close" size={18} color="#3F3F46" />
        </Pressable>
      </View>

      <Text style={styles.authHeroTitle}>Başlayın</Text>
      <Text style={styles.authHeroSub}>
        Tüm lezzetli tarifleri ve özellikleri{'\n'}keşfetmek için kayıt ol.
      </Text>

      <Pressable style={styles.authPrimaryButton} onPress={() => setAuthMode('register')}>
        <Ionicons name="mail-outline" size={24} color="#FFFFFF" />
        <Text style={styles.authPrimaryButtonText}>E-posta ile kayıt ol</Text>
      </Pressable>

      <Text style={styles.authTerms}>
        Kayıt olarak <Text style={styles.linkText}>kullanım koşullarını</Text> ve{' '}
        <Text style={styles.linkText}>gizlilik politikasını</Text> kabul ederim.
      </Text>

      <View style={styles.bottomSwitchWrap}>
        <Text style={styles.bottomSwitchText}>Zaten hesabın var mı?</Text>
        <Pressable onPress={() => setAuthMode('login')}>
          <Text style={styles.bottomSwitchLink}>Buradan giriş yap</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderLogin = () => (
    <View style={styles.authFormWrap}>
      <View style={styles.authTopBar}>
        <Pressable onPress={() => setAuthMode('getStarted')}>
          <Ionicons name="chevron-back" size={36} color="#3F3F46" />
        </Pressable>
        <Text style={styles.authTopTitle}>Giriş Yap</Text>
        <View style={styles.authTopSpacer} />
      </View>

      <TextInput
        value={authEmail}
        onChangeText={setAuthEmail}
        placeholder="E-posta"
        placeholderTextColor="#6B7280"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.authInput}
      />
      <View style={styles.authInputWithIcon}>
        <TextInput
          value={authPassword}
          onChangeText={setAuthPassword}
          placeholder="Şifre"
          placeholderTextColor="#6B7280"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          style={styles.authInputInner}
        />
        <Pressable onPress={() => setShowPassword((prev) => !prev)}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={26} color="#5B5B5B" />
        </Pressable>
      </View>

      <Text style={styles.forgotPass}>Şifreni mi unuttun?</Text>

      <Pressable style={styles.authPrimaryButton} onPress={onLogin} disabled={authLoading}>
        <Text style={styles.authPrimaryButtonText}>{authLoading ? 'Bekleyin...' : 'Devam Et'}</Text>
      </Pressable>

      <View style={styles.bottomSwitchWrapLarge}>
        <Text style={styles.bottomSwitchText}>Hesabın yok mu?</Text>
        <Pressable onPress={() => setAuthMode('register')}>
          <Text style={styles.bottomSwitchLink}>Kayıt ol</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderRegister = () => (
    <View style={styles.authFormWrap}>
      <View style={styles.authTopBar}>
        <Pressable onPress={() => setAuthMode('getStarted')}>
          <Ionicons name="chevron-back" size={36} color="#3F3F46" />
        </Pressable>
        <Text style={styles.authTopTitle}>E-posta ile Kayıt</Text>
        <View style={styles.authTopSpacer} />
      </View>

      <TextInput
        value={authEmail}
        onChangeText={setAuthEmail}
        placeholder="E-posta"
        placeholderTextColor="#6B7280"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.authInput}
      />
      <TextInput
        value={registerName}
        onChangeText={setRegisterName}
        placeholder="Kullanıcı adı"
        placeholderTextColor="#6B7280"
        autoCapitalize="words"
        style={styles.authInput}
      />
      <View style={styles.authInputWithIcon}>
        <TextInput
          value={authPassword}
          onChangeText={setAuthPassword}
          placeholder="Şifre"
          placeholderTextColor="#6B7280"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          style={styles.authInputInner}
        />
        <Pressable onPress={() => setShowPassword((prev) => !prev)}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={26} color="#5B5B5B" />
        </Pressable>
      </View>

      <Pressable style={styles.authPrimaryButton} onPress={onRegister} disabled={authLoading}>
          <Text style={styles.authPrimaryButtonText}>{authLoading ? 'Bekleyin...' : 'Kayıt Ol'}</Text>
      </Pressable>

      <Text style={styles.authTerms}>
        Kayıt olarak <Text style={styles.linkText}>kullanım koşullarını</Text> ve{' '}
        <Text style={styles.linkText}>gizlilik politikasını</Text> kabul ederim.
      </Text>

      <View style={styles.bottomSwitchWrapLarge}>
        <Text style={styles.bottomSwitchText}>Zaten hesabın var mı?</Text>
        <Pressable onPress={() => setAuthMode('login')}>
          <Text style={styles.bottomSwitchLink}>Buradan giriş yap</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {authMode === 'getStarted' ? renderGetStarted() : null}
      {authMode === 'login' ? renderLogin() : null}
      {authMode === 'register' ? renderRegister() : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  loggedOutContent: {
    flex: 1,
    paddingBottom: 32,
  },
  collageWrap: {
    position: 'relative',
    height: 360,
    marginBottom: 24,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  collageFade1: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  collageFade2: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  collageFade3: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: '#FFFFFF',
  },
  collageCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authHeroTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.8,
  },
  authHeroSub: {
    fontSize: 15,
    lineHeight: 24,
    color: '#6E6E73',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 28,
  },
  authPrimaryButton: {
    marginHorizontal: 24,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  authPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  authTerms: {
    marginTop: 18,
    paddingHorizontal: 30,
    fontSize: 13,
    lineHeight: 20,
    color: '#71717A',
    textAlign: 'center',
  },
  linkText: {
    color: '#1C1C1E',
    fontWeight: '600',
  },
  bottomSwitchWrap: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
  },
  bottomSwitchWrapLarge: {
    marginTop: 28,
    alignItems: 'center',
    gap: 6,
  },
  bottomSwitchText: {
    fontSize: 14,
    color: '#71717A',
  },
  bottomSwitchLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  authFormWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  authTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  authTopTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  authTopSpacer: {
    width: 36,
  },
  authInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#111111',
    marginBottom: 14,
  },
  authInputWithIcon: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  authInputInner: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
  },
  forgotPass: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'right',
    marginBottom: 24,
  },
});
