import { Stack, useLocalSearchParams } from 'expo-router';

import { AssistantChatPanel } from '@/components/assistant-chat-panel';

export default function AssistantChatScreen() {
  const params = useLocalSearchParams<{ recipeId?: string; recipeTitle?: string }>();
  const recipeTitle = typeof params.recipeTitle === 'string' ? params.recipeTitle : 'this recipe';

  return (
    <>
      <Stack.Screen options={{ title: 'Ask AI', headerShown: true }} />
      <AssistantChatPanel
        eyebrow="Recipe Assistant"
        title={recipeTitle}
        subtitle="Ask by text or voice and get quick help about ingredients, steps, cooking logic, or healthier alternatives."
        welcomeMessage={`You can ask anything about ${recipeTitle}. I can help with ingredients, steps, cooking logic, or healthier alternatives.`}
        placeholder="Write your recipe question..."
        quickPrompts={['How can I make this recipe healthier?', 'What pairs well with this recipe?']}
        buildMessage={(nextInput) =>
          params.recipeId
            ? `Recipe id: ${params.recipeId}. Recipe title: ${recipeTitle}. The user is asking about this recipe.\nQuestion: ${nextInput}`
            : nextInput
        }
      />
    </>
  );
}
