package com.student.recipe.service.assistant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.assistant.AssistantChatResponseDto;
import com.student.recipe.dto.assistant.UserAiProfileContextDto;
import com.student.recipe.entity.Conversation;
import com.student.recipe.entity.ConversationMessage;
import com.student.recipe.entity.enums.ConversationMessageRole;
import com.student.recipe.repository.UserRepository;
import com.student.recipe.service.MealTrackingService;
import com.student.recipe.vector.DocumentMatch;
import com.student.recipe.vector.EmbeddingVectorService;

@Service
public class AssistantChatService {

    private static final double RELEVANCE_THRESHOLD = 0.75;
    private static final int HISTORY_LIMIT = 6;
    private static final String DEFAULT_CONVERSATION_KEY = "default";

    private static final String SYSTEM_PROMPT = """
            You are a personalized nutrition assistant.
            Respond in English.
            
            STRICT RULES:
            - ALWAYS tailor your answer to the user profile provided.
            - If the user has allergies, NEVER suggest recipes containing those ingredients.
            - If the user has intolerances, avoid those ingredients.
            - Always align suggestions with the user's goal and diet type.
            - Use the CONTEXT section as your primary source. Do not fabricate recipe details.
            - Do not provide medical diagnoses or medication dosage advice.
            - If clinically urgent, advise contacting a doctor.
            - Use conversation history to maintain context across messages.
            - Use TODAY'S NUTRITION LOG to give personalized daily feedback.
            """;

    private final OpenAiService openAiService;
    private final UserAiProfileContextService userAiProfileContextService;
    private final UserAiContextPromptBuilder userAiContextPromptBuilder;
    private final EmbeddingVectorService vectorService;
    private final ConversationMemoryService conversationMemoryService;
    private final UserRepository userRepository;
    private final MealTrackingService mealTrackingService;

    public AssistantChatService(
            OpenAiService openAiService,
            UserAiProfileContextService userAiProfileContextService,
            UserAiContextPromptBuilder userAiContextPromptBuilder,
            EmbeddingVectorService vectorService,
            ConversationMemoryService conversationMemoryService,
            UserRepository userRepository,
            MealTrackingService mealTrackingService
    ) {
        this.openAiService = openAiService;
        this.userAiProfileContextService = userAiProfileContextService;
        this.userAiContextPromptBuilder = userAiContextPromptBuilder;
        this.vectorService = vectorService;
        this.conversationMemoryService = conversationMemoryService;
        this.userRepository = userRepository;
        this.mealTrackingService = mealTrackingService;
    }

    public AssistantChatResponseDto chat(String userEmail, String message) {
        if (message == null || message.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }

        // 1) Kullanıcı ID'sini çek
        Long userId = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"))
                .getId();

        // 2) Konuşma geçmişini çek
        Conversation conversation = conversationMemoryService.getOrCreate(userId, DEFAULT_CONVERSATION_KEY);
        List<ConversationMessage> history = conversationMemoryService.getLastMessages(conversation.getId(), HISTORY_LIMIT);
        String historyBlock = formatHistory(history);

        // 3) Kullanıcı profilini çek
        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);

        // 4) Günlük kalori bilgisi
        String dailyNutritionContext = buildDailyNutritionContext(userEmail);

        // 5) Semantic search
        List<DocumentMatch> matches = vectorService.findRelevant(message.trim(), 5);
        String ragContext = buildRagContext(matches);

        // 6) Final prompt
        String userPrompt = """
                === USER PROFILE ===
                %s
                
                %s
                
                === CONVERSATION HISTORY ===
                %s
                
                === RELEVANT RECIPES FROM DATABASE ===
                %s
                
                === USER QUESTION ===
                %s
                
                Answer based on the context above. Tailor the response to the user profile.
                """.formatted(
                profileContext,
                dailyNutritionContext,
                historyBlock.isBlank() ? "(No previous conversation)" : historyBlock,
                ragContext,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        // 7) Konuşmayı kaydet
        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return new AssistantChatResponseDto(
                answer,
                List.of("This response is for general informational purposes and does not replace medical advice."),
                List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
        );
    }

    private String buildDailyNutritionContext(String userEmail) {
        try {
            var dailyMeals = mealTrackingService.getDailyMeals(userEmail, null);
            if (dailyMeals == null) return "";

            StringBuilder sb = new StringBuilder();
            sb.append(String.format("""
                === TODAY'S NUTRITION LOG ===
                Total calories consumed: %.0f kcal
                Total protein: %.1f g
                Total carbs: %.1f g
                Total fat: %.1f g
                """,
                    dailyMeals.totalCalories() != null ? dailyMeals.totalCalories() : 0.0,
                    dailyMeals.totalProtein() != null ? dailyMeals.totalProtein() : 0.0,
                    dailyMeals.totalCarbs() != null ? dailyMeals.totalCarbs() : 0.0,
                    dailyMeals.totalFat() != null ? dailyMeals.totalFat() : 0.0
            ));

            if (dailyMeals.meals() != null) {
                for (var meal : dailyMeals.meals()) {
                    sb.append(meal.mealType()).append(":\n");
                    if (meal.items() != null) {
                        for (var item : meal.items()) {
                            sb.append("  - ").append(item.sourceName())
                                    .append(" (").append(String.format("%.0f", item.calories())).append(" kcal)\n");
                        }
                    }
                }
            }

            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private String formatHistory(List<ConversationMessage> history) {
        if (history == null || history.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (ConversationMessage m : history) {
            String role = m.getRole() == ConversationMessageRole.USER ? "User" : "Assistant";
            String content = m.getContent() == null ? "" : m.getContent().trim();
            if (content.length() > 500) content = content.substring(0, 500) + "...";
            sb.append(role).append(": ").append(content).append("\n");
        }
        return sb.toString().trim();
    }

    private String buildRagContext(List<DocumentMatch> matches) {
        if (matches == null || matches.isEmpty()) {
            return "(No relevant recipes found in the database.)";
        }

        StringBuilder sb = new StringBuilder();
        int idx = 1;
        for (DocumentMatch match : matches) {
            if (match.distance() > RELEVANCE_THRESHOLD) continue;
            sb.append("--- Recipe ").append(idx++).append(" ---\n");
            sb.append(match.text()).append("\n");

            Object url = match.metadata().get("source_url");
            if (url != null && !url.toString().isBlank()) {
                sb.append("URL: ").append(url).append("\n");
            }
            sb.append("\n");
        }

        if (sb.isEmpty()) {
            return "(No relevant recipes found in the database.)";
        }

        return sb.toString();
    }
}