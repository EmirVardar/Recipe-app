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
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chatWithAssistant } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export default function AssistantChatScreen() {
  const params = useLocalSearchParams<{ recipeId?: string; recipeTitle?: string }>();
  const { accessToken, isLoggedIn } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const recipeTitle = typeof params.recipeTitle === 'string' ? params.recipeTitle : 'bu tarif';

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: `${recipeTitle} hakkinda istedigini sorabilirsin. Malzeme, adimlar, pisirme mantigi ya da daha saglikli alternatifler konusunda yardimci olayim.`,
      },
    ]);
  }, [recipeTitle]);

  const handleSend = async (suggestedMessage?: string) => {
    const nextInput = (suggestedMessage ?? input).trim();
    if (!nextInput || !accessToken || !isLoggedIn || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: nextInput,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);
    setErrorMessage('');

    try {
      const recipeContext =
        params.recipeId && recipeTitle
          ? `Tarif id: ${params.recipeId}. Tarif adi: ${recipeTitle}. Kullanici bu tarifle ilgili soru soruyor.\nSoru: ${nextInput}`
          : nextInput;

      const response = await chatWithAssistant(accessToken, recipeContext);
      const assistantParts = [response.answer, ...(response.warnings ?? []), ...(response.suggestions ?? [])]
        .filter((part) => part && part.trim().length > 0)
        .join('\n\n');

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: assistantParts || 'Su anda net bir cevap uretemedim.',
        },
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Mesaj gonderilemedi.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ title: "AI'a Sor", headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Tarif Asistani</Text>
          <Text style={styles.title}>{recipeTitle}</Text>
          <Text style={styles.subtitle}>Bu ekran su an sadece soru sorup cevap alabildigin basit chat akisi icin hazirlandi.</Text>
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
                {message.role === 'user' ? 'Sen' : 'AI'}
              </Text>
              <Text style={[styles.messageText, message.role === 'user' ? styles.userText : styles.assistantText]}>
                {message.text}
              </Text>
            </View>
          ))}

          {loading ? (
            <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
              <ActivityIndicator size="small" color="#EA580C" />
              <Text style={styles.assistantText}>AI dusunuyor...</Text>
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
          <Pressable style={styles.quickChip} onPress={() => void handleSend('Bu tarif daha saglikli nasil yapilir?')}>
            <Text style={styles.quickChipText}>Daha saglikli yap</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => void handleSend('Bu tarifin yanina ne gider?')}>
            <Text style={styles.quickChipText}>Yanina ne gider?</Text>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Sorunu yaz..."
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            multiline
          />
          <Pressable style={[styles.sendButton, loading ? styles.sendButtonDisabled : null]} onPress={() => void handleSend()}>
            <Text style={styles.sendButtonText}>{loading ? '...' : 'Gonder'}</Text>
          </Pressable>
        </View>
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
  sendButton: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
