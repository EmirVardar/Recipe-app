import { Stack } from 'expo-router';

import { AssistantChatPanel } from '@/components/assistant-chat-panel';

const QUICK_PROMPTS = [
  'Hedefime uygun bir kahvalti oner',
  'Alerjilerime uygun bir ara ogun oner',
];

export default function AssistantLabScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'AI Test Merkezi', headerShown: true }} />
      <AssistantChatPanel
        eyebrow="Profil Asistani"
        title="AI Test Merkezi"
        subtitle="Asistani kayitli profil baglaminla yazi veya ses kullanarak test et."
        welcomeMessage="Hedefin, aktivite seviyen, alerjilerin, intoleranslarin ve beslenme tercihlerini kullanarak daha kisisel beslenme onerileri sunabilirim."
        placeholder="Beslenme planinla ilgili sor..."
        quickPrompts={QUICK_PROMPTS}
      />
    </>
  );
}
