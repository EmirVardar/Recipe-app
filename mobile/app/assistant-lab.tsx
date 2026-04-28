import { Stack } from 'expo-router';

import { AssistantChatPanel } from '@/components/assistant-chat-panel';

const QUICK_PROMPTS = [
  'Suggest a breakfast that matches my goal',
  'Suggest a snack that respects my allergies',
];

export default function AssistantLabScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'AI Test Center', headerShown: true }} />
      <AssistantChatPanel
        eyebrow="Profile Assistant"
        title="AI Test Center"
        subtitle="Test the assistant with your saved profile context using either text or voice."
        welcomeMessage="I can use your goal, activity level, allergies, intolerances, and food preferences to give more personalized nutrition suggestions."
        placeholder="Ask about your nutrition plan..."
        quickPrompts={QUICK_PROMPTS}
      />
    </>
  );
}
