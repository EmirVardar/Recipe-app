import { Stack, useLocalSearchParams } from 'expo-router';

import { AssistantChatPanel } from '@/components/assistant-chat-panel';

export default function AssistantChatScreen() {
  const params = useLocalSearchParams<{ recipeId?: string; recipeTitle?: string }>();
  const recipeTitle = typeof params.recipeTitle === 'string' ? params.recipeTitle : 'bu tarif';

  return (
    <>
      <Stack.Screen options={{ title: 'AI\'a Sor', headerShown: true }} />
      <AssistantChatPanel
        eyebrow="Tarif Asistani"
        title={recipeTitle}
        subtitle="Yazi veya sesle sor ve malzemeler, adimlar, pisirme mantigi ya da daha saglikli alternatifler hakkinda hizli destek al."
        welcomeMessage={`${recipeTitle} hakkinda istedigini sorabilirsin. Malzemeler, adimlar, pisirme mantigi veya daha saglikli alternatiflerde yardimci olabilirim.`}
        placeholder="Tarifle ilgili sorunu yaz..."
        quickPrompts={['Bunu nasil daha saglikli yaparim?', 'Bunun yanina ne iyi gider?']}
        buildMessage={(nextInput) =>
          params.recipeId
            ? `Tarif id: ${params.recipeId}. Tarif basligi: ${recipeTitle}. Kullanici bu tarif hakkinda soru soruyor.\nSoru: ${nextInput}`
            : nextInput
        }
      />
    </>
  );
}
