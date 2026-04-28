import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { chatWithAssistant, chatWithAssistantVoice } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  transcript?: string;
  mode?: 'text' | 'voice';
};

type AssistantChatPanelProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  placeholder: string;
  quickPrompts: string[];
  buildMessage?: (input: string) => string;
};

const RECORDING_OPTIONS = {
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
  web: undefined,
} as const;

function buildAssistantText(answer: string, warnings?: string[], suggestions?: string[]) {
  return [answer, ...(warnings ?? []), ...(suggestions ?? [])]
    .filter((part) => part && part.trim().length > 0)
    .join('\n\n');
}

async function writeAudioResponse(base64Audio: string) {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('Ses dosyasi icin uygun bir klasor bulunamadi.');
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
}: AssistantChatPanelProps) {
  const { accessToken, isLoggedIn } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(Platform.OS !== 'web');
  const scrollRef = useRef<ScrollView | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

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
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
    };
  }, []);

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
      pushAssistantMessage(buildAssistantText(response.answer, response.warnings, response.suggestions), {
        mode: 'text',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const startRecording = async () => {
    if (Platform.OS === 'web' || loading || isRecording) {
      setRecordingSupported(Platform.OS !== 'web');
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Mikrofon izni verilmedi.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(RECORDING_OPTIONS);
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setIsRecording(true);
      setErrorMessage('');
    } catch (error) {
      setRecordingSupported(false);
      setErrorMessage(error instanceof Error ? error.message : 'Ses kaydi baslatilamadi.');
    }
  };

  const stopRecording = async () => {
    if (!recording || !accessToken || !isLoggedIn) {
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error('Kaydedilen ses dosyasi bulunamadi.');
      }

      const response = await chatWithAssistantVoice(accessToken, {
        uri,
        name: `voice-message-${Date.now()}.m4a`,
        type: 'audio/m4a',
      });

      const assistantText = buildAssistantText(response.answer, response.warnings, response.suggestions);

      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text: response.transcribedText || 'Voice message sent',
          transcript: response.transcribedText,
          mode: 'voice',
        },
        {
          id: `assistant-${Date.now() + 1}`,
          role: 'assistant',
          text: assistantText || 'I could not produce a clear answer right now.',
          mode: 'voice',
        },
      ]);

      if (response.audio) {
        const audioUri = await writeAudioResponse(response.audio);
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true }
        );
        soundRef.current = sound;
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sesli mesaj gonderilemedi.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

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

        <View style={styles.voiceInfoCard}>
          <View style={styles.voiceInfoIconWrap}>
            <Ionicons name="mic" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.voiceInfoTextWrap}>
            <Text style={styles.voiceInfoTitle}>Voice chat is ready</Text>
            <Text style={styles.voiceInfoBody}>
              Hold the mic to record, release to send. The assistant will transcribe your voice and speak the reply back.
            </Text>
          </View>
        </View>

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
                {message.role === 'user' ? (message.mode === 'voice' ? 'You · Voice' : 'You') : 'AI'}
              </Text>
              <Text style={[styles.messageText, message.role === 'user' ? styles.userText : styles.assistantText]}>
                {message.text}
              </Text>
              {message.transcript ? <Text style={styles.transcriptText}>Transcript: {message.transcript}</Text> : null}
            </View>
          ))}

          {loading ? (
            <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
              <ActivityIndicator size="small" color="#EA580C" />
              <Text style={styles.assistantText}>{isRecording ? 'Listening...' : 'AI is thinking...'}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Message Note</Text>
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
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            multiline
          />

          <View style={styles.actionColumn}>
            <Pressable
              style={[styles.micButton, isRecording ? styles.micButtonActive : null, !recordingSupported ? styles.disabledButton : null]}
              onPressIn={() => {
                void startRecording();
              }}
              onPressOut={() => {
                if (isRecording) {
                  void stopRecording();
                }
              }}>
              <Ionicons name={isRecording ? 'radio-button-on' : 'mic'} size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable style={[styles.sendButton, loading ? styles.disabledButton : null]} onPress={() => void handleSend()}>
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {!recordingSupported ? (
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>Voice recording currently needs the native `expo-av` module and a mobile build.</Text>
          </View>
        ) : null}
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
    backgroundColor: '#F8FAFC',
  },
  headerCard: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 6,
  },
  eyebrow: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
  },
  voiceInfoCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: '#111827',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  voiceInfoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceInfoTextWrap: {
    flex: 1,
    gap: 4,
  },
  voiceInfoTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  voiceInfoBody: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 19,
  },
  messages: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 12,
  },
  messageBubble: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    maxWidth: '88%',
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: '#EA580C',
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
    color: '#9A3412',
  },
  userLabel: {
    color: '#FFEDD5',
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
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 18,
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
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  quickChip: {
    flex: 1,
    backgroundColor: '#FFF7ED',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickChipText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 8,
    backgroundColor: '#F8FAFC',
  },
  input: {
    flex: 1,
    minHeight: 54,
    maxHeight: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  actionColumn: {
    gap: 10,
  },
  micButton: {
    backgroundColor: '#C2410C',
    borderRadius: 18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#991B1B',
  },
  sendButton: {
    backgroundColor: '#111827',
    borderRadius: 18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
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
});
