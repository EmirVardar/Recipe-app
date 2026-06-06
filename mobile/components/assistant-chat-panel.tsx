import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addFridgeItem,
  chatWithAssistant,
  chatWithAssistantVoice,
  detectIngredients,
  findBestFoodProductMatch,
  recognizeFood,
  type FoodProductSearchItemResponse,
} from '@/lib/api';
import { translateMlLabel } from '@/lib/ml-labels';
import { useAuth } from '@/lib/auth';
import NativeAudio from 'native-audio';

console.log('[NativeAudio] module loaded:', NativeAudio);

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  transcript?: string;
  mode?: 'text' | 'voice';
  quickReplies?: string[];
  recipePreview?: {
    id: number;
    title: string;
    image: string | null;
  } | null;
};

type AssistantMode = 'chat' | 'voice';
type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking';

type AssistantChatPanelProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  placeholder: string;
  quickPrompts: string[];
  buildMessage?: (input: string) => string;
  enableModeTabs?: boolean;
  defaultMode?: AssistantMode;
};

const BARS = 34;
const FRAME_MS = 70;
const MIN_SCALE = 0.12;
const MAX_GAIN = 2.05;

const RECORDING_OPTIONS: Parameters<Audio.Recording['prepareToRecordAsync']>[0] = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeLevel(value: number) {
  return Math.pow(clamp01(value), 0.52);
}

function makeGains(count: number) {
  const mid = (count - 1) / 2;
  const centerBias = 0.8;
  const edgeFloor = 0.18;

  return Array.from({ length: count }, (_, index) => {
    const dist = Math.abs(index - mid) / mid;
    const gaussian = Math.exp(-Math.pow(dist / 0.52, 2));
    const shaped = edgeFloor + (1 - edgeFloor) * gaussian;
    const randomScale = 0.96 + Math.random() * 0.08;
    const gain = (1 - centerBias) * 1 + centerBias * shaped;

    return clamp01(gain * randomScale);
  });
}

function buildTravelKeyframes(
  bars: number,
  samples: number,
  options: { sigma?: number; freq?: number; floor?: number }
) {
  const sigma = options.sigma ?? 0.28;
  const freq = options.freq ?? 0.85;
  const floor = options.floor ?? 0.04;
  const inputRange = Array.from({ length: samples }, (_, index) => index / (samples - 1));
  const perBarOutputs = Array.from({ length: bars }, () => [] as number[]);

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const position = bars === 1 ? 0 : barIndex / (bars - 1);

    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
      const t = inputRange[sampleIndex];
      let distance = position - t;
      distance = ((distance + 1.5) % 1) - 0.5;

      const envelope = Math.exp(-Math.pow(distance / sigma, 2));
      const phase = 2 * Math.PI * (freq * (position - t));
      const carrier = 0.5 + 0.5 * Math.sin(phase);
      const shape = clamp01(floor + 0.75 * envelope * (0.55 + 0.45 * carrier));

      perBarOutputs[barIndex].push(shape);
    }
  }

  return { inputRange, perBarOutputs };
}

function buildAssistantText(answer: string) {
  return answer?.trim() ?? '';
}

function getDefaultFridgePayload(product: FoodProductSearchItemResponse) {
  if ((product.pieceGramWeight ?? 0) > 0) {
    return { quantity: 1, unitType: 'PIECE' as const, label: '1 adet' };
  }

  return { quantity: 100, unitType: 'GRAM' as const, label: '100 g' };
}

async function writeAudioResponse(base64Audio: string) {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('Ses dosyası için uygun bir klasör bulunamadı.');
  }

  const fileUri = `${directory}assistant-reply-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
}

export function AssistantChatPanel({
  eyebrow,
  title,
  subtitle,
  welcomeMessage,
  placeholder,
  quickPrompts,
  buildMessage,
  enableModeTabs = false,
  defaultMode = 'chat',
}: AssistantChatPanelProps) {
  const router = useRouter();
  const { accessToken, isLoggedIn } = useAuth();
  const [activeMode, setActiveMode] = useState<AssistantMode>(defaultMode);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(Platform.OS !== 'web');
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const scrollRef = useRef<ScrollView | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const hasTypedInput = input.trim().length > 0;

  const levelAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const travelT = useRef(new Animated.Value(0)).current;
  const mouthAmount = useRef(new Animated.Value(0)).current;
  const travelLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const isPressedRef = useRef(false);
  const nativeAudioSubRef = useRef<ReturnType<typeof NativeAudio.addListener> | null>(null);
  const gains = useRef(makeGains(BARS)).current;

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: welcomeMessage,
        mode: 'text',
      },
    ]);
  }, [welcomeMessage]);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      nativeAudioSubRef.current?.remove();
      try { NativeAudio.stop(); } catch {}
    };
  }, []);

  useEffect(() => {
    const usesTravel = voicePhase === 'idle' || voicePhase === 'thinking';

    if (usesTravel) {
      if (!travelLoopRef.current) {
        travelLoopRef.current = Animated.loop(
          Animated.timing(travelT, {
            toValue: 1,
            duration: 3400,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        travelLoopRef.current.start();
      }
    } else {
      travelLoopRef.current?.stop();
      travelLoopRef.current = null;
      travelT.setValue(0);
    }

    return () => {
      if (!usesTravel) {
        return;
      }
    };
  }, [travelT, voicePhase]);

  // Gerçek mikrofon seviyelerini NativeAudio'dan alıp animasyona yansıt
  useEffect(() => {
    nativeAudioSubRef.current = NativeAudio.addListener('onLevel', (p) => {
      if (!isPressedRef.current) return;
      animateLevel(clamp01(p.level));
    });
    return () => {
      nativeAudioSubRef.current?.remove();
      nativeAudioSubRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Animated.timing(mouthAmount, {
      toValue: voicePhase === 'listening' || voicePhase === 'speaking' ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [mouthAmount, voicePhase]);

  const animateLevel = (lvl: number) => {
    Animated.timing(levelAnim, {
      toValue: lvl,
      duration: FRAME_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(glowAnim, {
      toValue: Math.min(1, lvl * 1.05),
      duration: FRAME_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const resetWave = () => {
    levelAnim.setValue(0);
    glowAnim.setValue(0);
  };

  const pushAssistantMessage = (text: string, extra?: Partial<ChatMessage>) => {
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text,
        ...extra,
      },
    ]);
  };

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const formatNaturalList = (items: string[]) => {
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    if (cleaned.length === 0) return '';
    if (cleaned.length === 1) return cleaned[0];
    if (cleaned.length === 2) return `${cleaned[0]} ve ${cleaned[1]}`;
    return `${cleaned.slice(0, -1).join(', ')} ve ${cleaned[cleaned.length - 1]}`;
  };

  const pickImage = async (): Promise<string | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets || !result.assets[0]) return null;
    return result.assets[0].uri;
  };

  const handleFoodRecognition = async () => {
    if (loading) return;
    try {
      const imageUri = await pickImage();
      if (!imageUri) return;

      setLoading(true);
      setErrorMessage('');

      const { food_name, confidence } = await recognizeFood(imageUri);
      const readableName = translateMlLabel(food_name);

      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text: `📷 Tespit edilen yemek ${readableName} gibi görünüyor (%${Math.round(confidence * 100)} emin). Buna uygun tarif verir misin?`,
          mode: 'text',
        },
      ]);

      if (!accessToken || !isLoggedIn) return;
      const response = await chatWithAssistant(accessToken, `Tespit edilen yemek ${readableName}. Bana buna uygun bir tarif verir misin?`);
      pushAssistantMessage(buildAssistantText(response.answer), { mode: 'text' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert('Hata', msg);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleIngredientScan = async () => {
    if (loading) return;
    try {
      const imageUri = await pickImage();
      if (!imageUri) return;

      setLoading(true);
      setErrorMessage('');

      const { ingredients } = await detectIngredients(imageUri);
      if (!ingredients || ingredients.length === 0) {
        setErrorMessage('Hiç malzeme tespit edilemedi.');
        return;
      }

      const translatedIngredients = ingredients.map((i) => ({
        name: translateMlLabel(i.name),
        confidence: Math.round(i.confidence * 100),
      }));
      const ingredientList = translatedIngredients
        .map((i) => `${i.name} (%${i.confidence})`)
        .join(', ');

      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text: `📷 Tespit edilen malzemeler: ${ingredientList}`,
          mode: 'text',
        },
      ]);

      if (!accessToken || !isLoggedIn) return;

      const matches = await Promise.all(
        translatedIngredients.map(async (ingredient) => {
          return {
            ingredient,
            product: await findBestFoodProductMatch(ingredient.name),
          };
        })
      );

      const foundMatches = matches.filter(
        (item): item is { ingredient: (typeof translatedIngredients)[number]; product: FoodProductSearchItemResponse } =>
          item.product != null
      );
      const missingNames = matches.filter((item) => item.product == null).map((item) => item.ingredient.name);

      if (!foundMatches.length) {
        const notFoundText = missingNames.length
          ? `Tespit edilen malzemeleri ürün veritabanında bulamadım: ${formatNaturalList(missingNames)}.`
          : 'Tespit edilen malzemeler ürün veritabanında bulunamadı.';
        pushAssistantMessage(notFoundText, { mode: 'text' });
        return;
      }

      const foundSummary = foundMatches
        .map(({ product }) => {
          const defaults = getDefaultFridgePayload(product);
          return `${product.name} (${defaults.label})`;
        })
        .join(', ');
      const missingSummary = missingNames.length ? `\nBulunamayanlar: ${formatNaturalList(missingNames)}.` : '';

      const shouldAdd = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Buzdolabına Ekle',
          `${foundSummary} buzdolabına eklensin mi?${missingSummary}`,
          [
            { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Ekle', onPress: () => resolve(true) },
          ]
        );
      });

      if (!shouldAdd) {
        pushAssistantMessage('Malzeme ekleme işlemi iptal edildi.', { mode: 'text' });
        return;
      }

      await Promise.all(
        foundMatches.map(({ product }) => {
          const defaults = getDefaultFridgePayload(product);
          return addFridgeItem(accessToken, {
            foodProductId: product.id,
            quantity: defaults.quantity,
            unitType: defaults.unitType,
          });
        })
      );

      const successText = missingNames.length
        ? `${formatNaturalList(foundMatches.map((item) => item.product.name))} buzdolabına eklendi. ${formatNaturalList(
            missingNames
          )} için eşleşme bulunamadı.`
        : `${formatNaturalList(foundMatches.map((item) => item.product.name))} buzdolabına eklendi.`;
      pushAssistantMessage(successText, { mode: 'text' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert('Hata', msg);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleImagePick = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['İptal', 'Malzeme Tara', 'Yemek Tanı'],
        cancelButtonIndex: 0,
        title: 'Ne yapmak istiyorsun?',
      },
      (buttonIndex) => {
        if (buttonIndex === 1) void handleIngredientScan();
        if (buttonIndex === 2) void handleFoodRecognition();
      }
    );
  };

  const handleSend = async (suggestedMessage?: string) => {
    const rawInput = (suggestedMessage ?? input).trim();
    if (!rawInput || !accessToken || !isLoggedIn || loading) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: rawInput,
        mode: 'text',
      },
    ]);
    setInput('');
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await chatWithAssistant(accessToken, buildMessage ? buildMessage(rawInput) : rawInput);
      pushAssistantMessage(buildAssistantText(response.answer), {
        mode: 'text',
        quickReplies: response.quickReplies ?? undefined,
        recipePreview: response.recipePreview ?? null,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Mesaj gönderilemedi.');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const startRecording = async () => {
    if (Platform.OS === 'web' || loading || isRecording) {
      setRecordingSupported(Platform.OS !== 'web');
      return;
    }

    try {
      isPressedRef.current = true;
      setVoicePhase('listening');
      setErrorMessage('');

      const granted = await NativeAudio.requestPermission();
      if (!granted) {
        setErrorMessage('Mikrofon izni verilmedi.');
        isPressedRef.current = false;
        setVoicePhase('idle');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(RECORDING_OPTIONS);
      await nextRecording.startAsync();

      NativeAudio.configure(FRAME_MS);
      await NativeAudio.start();

      setRecording(nextRecording);
      setIsRecording(true);
    } catch (error) {
      isPressedRef.current = false;
      setRecordingSupported(false);
      setVoicePhase('idle');
      resetWave();
      setErrorMessage(error instanceof Error ? error.message : 'Ses kaydı başlatılamadı.');
    }
  };

  const stopRecording = async () => {
    if (!recording || !accessToken || !isLoggedIn) {
      setVoicePhase('idle');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setIsRecording(false);
    isPressedRef.current = false;
    setVoicePhase('thinking');
    resetWave();
    const voiceRequestStartMs = Date.now();

    try {
      NativeAudio.stop();
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error('Kaydedilen ses dosyası bulunamadı.');
      }

      const response = await chatWithAssistantVoice(accessToken, {
        uri,
        name: `voice-message-${Date.now()}.m4a`,
        type: 'audio/m4a',
      });

      const assistantText = buildAssistantText(response.answer);

      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text: response.transcribedText || 'Sesli mesaj gönderildi',
          transcript: response.transcribedText,
          mode: 'voice',
        },
        {
          id: `assistant-${Date.now() + 1}`,
          role: 'assistant',
          text: assistantText || 'Şu anda net bir yanıt üretemedim.',
          mode: 'voice',
          quickReplies: response.quickReplies ?? undefined,
        },
      ]);

      if (response.audio) {
        NativeAudio.activatePlaybackSession();
        const audioUri = await writeAudioResponse(response.audio);
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        let waveformLevels: number[] = [];
        try {
          waveformLevels = await NativeAudio.analyzeFile(audioUri, FRAME_MS);
        } catch {}

        const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
        soundRef.current = sound;
        setVoicePhase('speaking');

        await sound.setProgressUpdateIntervalAsync(FRAME_MS);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;

          if (waveformLevels.length > 0) {
            const pos = typeof (status as any).positionMillis === 'number' ? (status as any).positionMillis : 0;
            const idx = Math.min(waveformLevels.length - 1, Math.floor(pos / FRAME_MS));
            animateLevel(clamp01(waveformLevels[idx]));
          }

          if ((status as any).didJustFinish) {
            resetWave();
            void sound.unloadAsync();
            soundRef.current = null;
            setVoicePhase('idle');
          }
        });
        await sound.playAsync();
        console.log('PERF_VOICE_CLIENT_SUMMARY totalVoiceResponseMs=', Date.now() - voiceRequestStartMs);
      } else {
        console.log('PERF_VOICE_CLIENT_SUMMARY totalVoiceResponseMs=', Date.now() - voiceRequestStartMs);
        setVoicePhase('idle');
      }
    } catch (error) {
      resetWave();
      setVoicePhase('idle');
      setErrorMessage(error instanceof Error ? error.message : 'Sesli mesaj gönderilemedi.');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const stopPlayback = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } finally {
      resetWave();
      setVoicePhase('idle');
    }
  };

  const latestVoiceTranscript = [...messages].reverse().find((message) => message.role === 'user' && message.mode === 'voice');
  const latestVoiceReply = [...messages].reverse().find((message) => message.role === 'assistant' && message.mode === 'voice');

  const { inputRange, perBarOutputs } = useMemo(() => buildTravelKeyframes(BARS, 25, { sigma: 0.28, freq: 0.85, floor: 0.04 }), []);

  const energyRaw = useMemo(
    () =>
      levelAnim.interpolate({
        inputRange: [0, 0.2, 0.45, 0.75, 1],
        outputRange: [0, 0.08, 0.42, 0.78, 1],
        extrapolate: 'clamp',
      }),
    [levelAnim]
  );

  const mouthWeightForIndex = useMemo(() => {
    const mid = (BARS - 1) / 2;
    return Array.from({ length: BARS }, (_, index) => {
      const dist = Math.abs(index - mid) / mid;
      const weight = Math.exp(-Math.pow(dist / 0.42, 2));
      return clamp01(0.2 + 0.8 * weight);
    });
  }, []);

  const barViews = useMemo(() => {
    const idleAmp = 0.04;
    const travelBoost = 0.2;
    const mouthBase = 0.1;
    const mouthBoost = 1.5;
    const oneMinusMouth = Animated.subtract(1, mouthAmount);

    return gains.map((gain, index) => {
      const travelShape = travelT.interpolate({
        inputRange,
        outputRange: perBarOutputs[index],
        extrapolate: 'clamp',
      });

      const travelCombined = Animated.multiply(
        travelShape,
        Animated.add(idleAmp, Animated.multiply(travelBoost, travelShape))
      );

      const mouthCombined = Animated.multiply(
        Animated.add(mouthBase, Animated.multiply(mouthBoost, energyRaw)),
        mouthWeightForIndex[index]
      );

      const blended = Animated.add(
        Animated.multiply(travelCombined, oneMinusMouth),
        Animated.multiply(mouthCombined, mouthAmount)
      );

      const scaleY = blended.interpolate({
        inputRange: [0, 1.15],
        outputRange: [MIN_SCALE + 0.01, MIN_SCALE + 0.01 + (MAX_GAIN * 1.1) * gain],
        extrapolate: 'clamp',
      });

      const scaleX = blended.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.015],
        extrapolate: 'clamp',
      });

      return (
        <Animated.View
          key={`bar-${index}`}
          style={[
            styles.waveBar,
            {
              width: 3 + (gain > 0.88 ? 1 : 0),
              opacity: 0.66 + 0.34 * gain,
              transform: [{ scaleY }, { scaleX }],
            },
          ]}
        />
      );
    });
  }, [energyRaw, gains, inputRange, mouthAmount, mouthWeightForIndex, perBarOutputs, travelT]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.18],
    extrapolate: 'clamp',
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
    extrapolate: 'clamp',
  });

  const voicePhaseLabel = useMemo(() => {
    switch (voicePhase) {
      case 'listening':
        return 'Dinliyorum';
      case 'thinking':
        return 'Düşünüyorum';
      case 'speaking':
        return 'Konuşuyorum';
      case 'idle':
      default:
        return 'Hazır';
    }
  }, [voicePhase]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {enableModeTabs ? (
          <View style={styles.modeTabs}>
            <Pressable
              onPress={() => setActiveMode('chat')}
              style={[styles.modeTab, activeMode === 'chat' ? styles.modeTabActive : null]}>
              <Text style={[styles.modeTabText, activeMode === 'chat' ? styles.modeTabTextActive : null]}>
                Sohbet
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveMode('voice')}
              style={[styles.modeTab, activeMode === 'voice' ? styles.modeTabActive : null]}>
              <Text style={[styles.modeTabText, activeMode === 'voice' ? styles.modeTabTextActive : null]}>
                Sesli
              </Text>
            </Pressable>
          </View>
        ) : null}

        {activeMode === 'chat' ? (
          <>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.messageBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={[styles.messageLabel, message.role === 'user' ? styles.userLabel : styles.assistantLabel]}>
                    {message.role === 'user' ? (message.mode === 'voice' ? 'Sen · Ses' : 'Sen') : 'Asistan'}
                  </Text>
                  <Text style={[styles.messageText, message.role === 'user' ? styles.userText : styles.assistantText]}>
                    {message.text}
                  </Text>
                  {message.recipePreview ? (
                    <Pressable
                      style={styles.recipePreviewCard}
                      onPress={() => router.push(`/recipes/${message.recipePreview?.id}`)}>
                      <Image
                        source={{
                          uri:
                            message.recipePreview.image ??
                            'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80',
                        }}
                        style={styles.recipePreviewImage}
                      />
                      <View style={styles.recipePreviewContent}>
                        <Text style={styles.recipePreviewEyebrow}>Tarif</Text>
                        <Text style={styles.recipePreviewTitle}>{message.recipePreview.title}</Text>
                      </View>
                    </Pressable>
                  ) : null}
                  {message.transcript ? <Text style={styles.transcriptText}>Metin: {message.transcript}</Text> : null}
                </View>
              ))}

              {loading ? (
                <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                  <ActivityIndicator size="small" color="#111111" />
                  <Text style={styles.assistantText}>
                    {isRecording ? 'Dinleniyor...' : voicePhase === 'thinking' ? 'Asistan düşünüyor...' : 'Asistan hazırlanıyor...'}
                  </Text>
                </View>
              ) : null}

              {errorMessage ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Mesaj Notu</Text>
                  <Text style={styles.errorBody}>{errorMessage}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.quickRow}>
              {quickPrompts.map((prompt) => (
                <Pressable key={prompt} style={styles.quickChip} onPress={() => void handleSend(prompt)}>
                  <Text style={styles.quickChipText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inputRow}>
              <Pressable
                style={[styles.cameraButton, loading ? styles.disabledButton : null]}
                onPress={() => void handleImagePick()}
                disabled={loading}>
                <Ionicons name="camera" size={20} color="#111111" />
              </Pressable>

              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={placeholder}
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                multiline
              />

              <Pressable
                style={[
                  hasTypedInput ? styles.sendButton : styles.micButton,
                  isRecording ? styles.micButtonActive : null,
                  (loading || (!hasTypedInput && !recordingSupported)) ? styles.disabledButton : null,
                ]}
                onPress={() => {
                  if (hasTypedInput) {
                    void handleSend();
                  }
                }}
                onPressIn={() => {
                  if (!hasTypedInput) {
                    void startRecording();
                  }
                }}
                onPressOut={() => {
                  if (!hasTypedInput && isRecording) {
                    void stopRecording();
                  }
                }}>
                <Ionicons
                  name={hasTypedInput ? 'send' : isRecording ? 'radio-button-on' : 'mic'}
                  size={18}
                  color={hasTypedInput ? '#FFFFFF' : '#111111'}
                />
              </Pressable>
            </View>

            {!recordingSupported ? (
              <View style={styles.footerNote}>
                <Text style={styles.footerNoteText}>Ses kaydı için şu anda yerel `expo-av` modülü ve mobil build gerekiyor.</Text>
              </View>
            ) : null}
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.voiceScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.voiceCard}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.waveGlow,
                  {
                    opacity: glowOpacity,
                    transform: [{ scale: glowScale }],
                  },
                ]}
              />

              <View style={styles.voiceBadge}>
                <View style={[styles.voiceDot, voicePhase === 'idle' ? styles.voiceDotIdle : styles.voiceDotActive]} />
                <Text style={styles.voiceBadgeText}>{voicePhaseLabel}</Text>
              </View>

              <View style={styles.waveRow}>{barViews}</View>

              <Text style={styles.voiceCaption}>
                {voicePhase === 'idle'
                  ? 'Basılı tutarak konuş, bırakınca otomatik gönderilir.'
                  : voicePhase === 'listening'
                    ? 'Şu an seni dinliyorum.'
                    : voicePhase === 'thinking'
                      ? 'Yanıt hazırlanıyor.'
                      : 'Yanıt sesli olarak oynatılıyor.'}
              </Text>
            </View>

            <Pressable
              disabled={loading || !recordingSupported}
              onPress={() => {
                if (voicePhase === 'speaking') {
                  void stopPlayback();
                }
              }}
              onPressIn={() => {
                if (voicePhase !== 'speaking') {
                  void startRecording();
                }
              }}
              onPressOut={() => {
                if (voicePhase !== 'speaking' && isRecording) {
                  void stopRecording();
                }
              }}
              style={({ pressed }) => [
                styles.voiceTrigger,
                pressed && !loading && recordingSupported ? styles.voiceTriggerPressed : null,
                loading || !recordingSupported ? styles.disabledButton : null,
              ]}>
            <View style={[styles.voiceTriggerInner, isRecording ? styles.voiceTriggerInnerActive : null]}>
                <Ionicons name={voicePhase === 'speaking' ? 'stop' : isRecording ? 'radio-button-on' : 'mic'} size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.voiceTriggerLabel}>
                {voicePhase === 'speaking'
                  ? 'Durdur'
                  : isRecording
                    ? 'Bırakınca gönderilir'
                    : 'Basılı tut ve konuş'}
              </Text>
            </Pressable>

            {latestVoiceTranscript ? (
              <View style={styles.voiceResultCard}>
                <Text style={styles.voiceResultLabel}>Son sesli mesajın</Text>
                <Text style={styles.voiceResultText}>{latestVoiceTranscript.text}</Text>
              </View>
            ) : null}

            {latestVoiceReply ? (
              <View style={styles.voiceResultCard}>
                <Text style={styles.voiceResultLabel}>Asistan yanıtı</Text>
                <Text style={styles.voiceResultText}>{latestVoiceReply.text}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Sesli Not</Text>
                <Text style={styles.errorBody}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  headerCard: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 8,
    alignItems: 'center',
  },
  eyebrow: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111111',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  modeTabs: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#ECECF0',
    flexDirection: 'row',
    gap: 4,
  },
  modeTab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  modeTabText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#111111',
  },
  messages: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 13,
    gap: 6,
    maxWidth: '86%',
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: '#111111',
    alignSelf: 'flex-end',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assistantLabel: {
    color: '#8E8E93',
  },
  userLabel: {
    color: '#D1D5DB',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantText: {
    color: '#111827',
  },
  userText: {
    color: '#FFFFFF',
  },
  transcriptText: {
    color: '#E5E7EB',
    fontSize: 12,
    lineHeight: 18,
  },
  recipePreviewCard: {
    marginTop: 6,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recipePreviewImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E5E7EB',
  },
  recipePreviewContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  recipePreviewEyebrow: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipePreviewTitle: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    color: '#9A3412',
    fontSize: 14,
    fontWeight: '800',
  },
  errorBody: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 19,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  quickReplyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickReplyButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  quickReplyText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '600',
  },
  quickChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  quickChipText: {
    color: '#3A3A3C',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 8,
    backgroundColor: '#F5F5F7',
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
  },
  cameraButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#D1D5DB',
  },
  sendButton: {
    backgroundColor: '#111111',
    borderRadius: 18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.55,
  },
  footerNote: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  footerNoteText: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },
  voiceScroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  voiceCard: {
    marginTop: 8,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
    gap: 16,
  },
  voiceBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  voiceDotIdle: {
    backgroundColor: '#9CA3AF',
  },
  voiceDotActive: {
    backgroundColor: '#111111',
  },
  voiceBadgeText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
  },
  waveGlow: {
    position: 'absolute',
    left: -44,
    right: -44,
    top: -34,
    bottom: -34,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  waveRow: {
    height: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  waveBar: {
    height: 48,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  voiceCaption: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
  },
  voiceTrigger: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 10,
  },
  voiceTriggerPressed: {
    transform: [{ scale: 0.985 }],
  },
  voiceTriggerInner: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  voiceTriggerInnerActive: {
    backgroundColor: '#2F2F31',
  },
  voiceTriggerLabel: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
  },
  voiceResultCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 6,
  },
  voiceResultLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  voiceResultText: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 22,
  },
});
