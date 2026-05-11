import { AssistantChatPanel } from '@/components/assistant-chat-panel';

const QUICK_PROMPTS = [
  'Hedefime uygun bir kahvaltı öner',
  'Alerjilerime uygun bir ara öğün öner',
];

export default function SearchTabScreen() {
  return (
    <AssistantChatPanel
      eyebrow="Recipulse AI"
      title="Assistant"
      subtitle="Asistanı kayıtlı profil bağlamınla yazı veya ses kullanarak daha doğal biçimde test et."
      welcomeMessage="Hedefin, aktivite seviyen, alerjilerin, intoleransların ve beslenme tercihlerini kullanarak daha kişisel beslenme önerileri sunabilirim."
      placeholder="Beslenme planınla ilgili sor..."
      quickPrompts={QUICK_PROMPTS}
      enableModeTabs
    />
  );
}
