package com.student.recipe.service.assistant;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.student.recipe.dto.assistant.AssistantChatResponseDto;
import com.student.recipe.dto.assistant.UserAiProfileContextDto;
import com.student.recipe.dto.meal.MealLogItemCreateRequestDto;
import com.student.recipe.dto.meal.RecipeMealLogItemCreateRequestDto;
import com.student.recipe.entity.Conversation;
import com.student.recipe.entity.ConversationMessage;
import com.student.recipe.entity.enums.ConversationMessageRole;
import com.student.recipe.repository.UserRepository;
import com.student.recipe.service.MealTrackingService;
import com.student.recipe.service.UserFridgeService;
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

    private static final String INTENT_SYSTEM_PROMPT = """
            You are an intent detector for a nutrition app.
            Analyze the user message and return ONLY a JSON object, nothing else.
            
            If the user says they ate/had/consumed something, return:
            {
              "intent": "LOG_MEAL",
              "food_name": "<extracted food name>",
              "meal_type": "<BREAKFAST|LUNCH|DINNER|SNACK>",
              "servings": 1.0
            }
            
            If the user asks about their personal nutrition data, daily progress,
            calories consumed, calories remaining, what they ate today, or how they are doing, return:
            {
              "intent": "PERSONAL_QUERY"
            }

            If the user asks what they have in their fridge, what ingredients are left,
            what they can cook with ingredients at home, or asks for recipe ideas based on fridge items, return:
            {
              "intent": "FRIDGE_QUERY"
            }

            If the user wants to add something to their fridge, return:
            {
              "intent": "FRIDGE_ADD_ITEM",
              "food_name": "<extracted food name>",
              "quantity": 1.0,
              "unit_type": "<GRAM|PIECE>"
            }
            
            For everything else (recipe suggestions, food questions, general nutrition advice), return:
            {
              "intent": "OTHER"
            }
            
            meal_type rules:
            - morning/breakfast → BREAKFAST
            - lunch/midday → LUNCH
            - dinner/evening/night → DINNER
            - snack/other → SNACK
            - if not specified → DINNER
            
            Return ONLY the JSON, no explanation.
            """;

    private final OpenAiService openAiService;
    private final UserAiProfileContextService userAiProfileContextService;
    private final UserAiContextPromptBuilder userAiContextPromptBuilder;
    private final EmbeddingVectorService vectorService;
    private final ConversationMemoryService conversationMemoryService;
    private final UserRepository userRepository;
    private final MealTrackingService mealTrackingService;
    private final UserFridgeService userFridgeService;
    private final UserFridgeContextService userFridgeContextService;
    private final UserDailyHealthContextService userDailyHealthContextService;
    private final ObjectMapper objectMapper;

    public AssistantChatService(
            OpenAiService openAiService,
            UserAiProfileContextService userAiProfileContextService,
            UserAiContextPromptBuilder userAiContextPromptBuilder,
            EmbeddingVectorService vectorService,
            ConversationMemoryService conversationMemoryService,
            UserRepository userRepository,
            MealTrackingService mealTrackingService,
            UserFridgeService userFridgeService,
            UserFridgeContextService userFridgeContextService,
            UserDailyHealthContextService userDailyHealthContextService,
            ObjectMapper objectMapper
    ) {
        this.openAiService = openAiService;
        this.userAiProfileContextService = userAiProfileContextService;
        this.userAiContextPromptBuilder = userAiContextPromptBuilder;
        this.vectorService = vectorService;
        this.conversationMemoryService = conversationMemoryService;
        this.userRepository = userRepository;
        this.mealTrackingService = mealTrackingService;
        this.userFridgeService = userFridgeService;
        this.userFridgeContextService = userFridgeContextService;
        this.userDailyHealthContextService = userDailyHealthContextService;
        this.objectMapper = objectMapper;
    }

    public AssistantChatResponseDto chat(String userEmail, String message) {
        if (message == null || message.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }

        Long userId = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"))
                .getId();

        Conversation conversation = conversationMemoryService.getOrCreate(userId, DEFAULT_CONVERSATION_KEY);
        List<ConversationMessage> history = conversationMemoryService.getLastMessages(conversation.getId(), HISTORY_LIMIT);
        String historyBlock = formatHistory(history);

        // 1) Pending action var mı kontrol et
        if (conversation.getPendingActionType() != null) {
            return handlePendingConfirmation(userEmail, message, conversation, historyBlock);
        }

        // 2) Intent detection
        String intentJson = openAiService.chat(INTENT_SYSTEM_PROMPT, message.trim());
        String intent = extractIntent(intentJson);

        // 3) Intent'e göre yönlendir
        if ("LOG_MEAL".equals(intent)) {
            return handleLogMealIntent(userEmail, message, intentJson, conversation, historyBlock);
        }

        if ("PERSONAL_QUERY".equals(intent)) {
            return handlePersonalQuery(userEmail, message, conversation, historyBlock);
        }

        if ("FRIDGE_QUERY".equals(intent)) {
            return handleFridgeQuery(userEmail, message, conversation, historyBlock);
        }

        if ("FRIDGE_ADD_ITEM".equals(intent)) {
            return handleFridgeAddIntent(userEmail, message, intentJson, conversation, historyBlock);
        }

        // 4) OTHER → Normal RAG flow
        return handleNormalChat(userEmail, message, conversation, historyBlock);
    }

    // ── PENDING CONFIRMATION ────────────────────────────────────────

    private AssistantChatResponseDto handlePendingConfirmation(
            String userEmail, String message, Conversation conversation, String historyBlock) {

        String trimmed = message.trim().toLowerCase();
        boolean confirmed = trimmed.equals("yes") || trimmed.equals("yeah") ||
                trimmed.equals("yep") || trimmed.equals("ok") ||
                trimmed.equals("okay") || trimmed.equals("sure") ||
                trimmed.equals("add it") || trimmed.equals("confirm");

        boolean rejected = trimmed.equals("no") || trimmed.equals("nope") ||
                trimmed.equals("cancel") || trimmed.equals("don't") ||
                trimmed.equals("skip");

        if (confirmed) {
            String answer = executePendingAction(userEmail, conversation);
            conversationMemoryService.clearPendingAction(conversation);
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return new AssistantChatResponseDto(
                    answer,
                    List.of("This response is for general informational purposes and does not replace medical advice."),
                    List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
            );
        }

        if (rejected) {
            conversationMemoryService.clearPendingAction(conversation);
            String answer = "Got it, I won't make that change. Let me know if you need anything else!";
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return new AssistantChatResponseDto(
                    answer,
                    List.of("This response is for general informational purposes and does not replace medical advice."),
                    List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
            );
        }

        String answer = "I'm waiting for your confirmation. Reply 'yes' to confirm or 'no' to cancel.";
        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
        return new AssistantChatResponseDto(
                answer,
                List.of("This response is for general informational purposes and does not replace medical advice."),
                List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
        );
    }

    private String executePendingAction(String userEmail, Conversation conversation, Map<String, Object> actionData) {
        try {
            String sourceType = (String) actionData.get("sourceType");

            if ("FRIDGE".equals(sourceType)) {
                Long foodId = ((Number) actionData.get("sourceId")).longValue();
                String sourceName = (String) actionData.get("sourceName");
                double quantity = ((Number) actionData.get("quantity")).doubleValue();
                String unitType = (String) actionData.get("unitType");

                userFridgeService.addItem(userEmail, new com.student.recipe.dto.fridge.FridgeItemCreateRequestDto(
                        foodId, quantity, unitType
                ));

                return String.format("✓ **%s** has been added to your fridge (%s %s).",
                        sourceName,
                        formatCompactNumber(quantity),
                        "PIECE".equals(unitType) ? "piece" + (quantity == 1 ? "" : "s") : "g");
            }
        } catch (Exception ignored) {
            return "Sorry, I couldn't complete that fridge action. Please try again.";
        }

        return null;
    }

    private String executePendingAction(String userEmail, Conversation conversation) {
        try {
            String data = conversation.getPendingActionData();
            Map<String, Object> actionData = objectMapper.readValue(data, Map.class);

            String customActionResult = executePendingAction(userEmail, conversation, actionData);
            if (customActionResult != null) {
                return customActionResult;
            }

            String sourceType = (String) actionData.get("sourceType");
            String mealType = (String) actionData.get("mealType");
            String sourceName = (String) actionData.get("sourceName");
            double calories = ((Number) actionData.get("calories")).doubleValue();

            if ("RECIPE".equals(sourceType)) {
                Long recipeId = ((Number) actionData.get("sourceId")).longValue();
                double servings = ((Number) actionData.get("servings")).doubleValue();
                mealTrackingService.addRecipeMealItem(userEmail, new RecipeMealLogItemCreateRequestDto(
                        LocalDate.now(), mealType, recipeId, servings
                ));
            } else {
                Long foodId = ((Number) actionData.get("sourceId")).longValue();
                double quantity = ((Number) actionData.get("quantity")).doubleValue();
                String unitType = (String) actionData.get("unitType");
                mealTrackingService.addMealItem(userEmail, new MealLogItemCreateRequestDto(
                        LocalDate.now(), mealType, foodId, quantity, unitType
                ));
            }

            return String.format("✓ **%s** has been added to your %s log (%.0f kcal). Your daily total has been updated!",
                    sourceName, mealType.toLowerCase(), calories);

        } catch (Exception e) {
            return "Sorry, I couldn't add that to your log. Please try again.";
        }
    }

    // ── LOG MEAL INTENT ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private AssistantChatResponseDto handleLogMealIntent(
            String userEmail, String message, String intentJson,
            Conversation conversation, String historyBlock) {

        try {
            Map<String, Object> intentData = objectMapper.readValue(intentJson, Map.class);
            String foodName = (String) intentData.get("food_name");
            String mealType = (String) intentData.getOrDefault("meal_type", "DINNER");
            double servings = ((Number) intentData.getOrDefault("servings", 1.0)).doubleValue();

            // ChromaDB'den en yakın sonucu al - recipe veya food fark etmez
            List<DocumentMatch> matches = vectorService.findRelevant(foodName, 5);
            DocumentMatch bestMatch = matches.stream()
                    .filter(m -> m.distance() <= RELEVANCE_THRESHOLD)
                    .filter(m -> "recipe".equals(m.metadata().get("kind"))
                            || "food".equals(m.metadata().get("kind")))
                    .findFirst()
                    .orElse(null);

            if (bestMatch != null) {
                String kind = (String) bestMatch.metadata().get("kind");

                if ("recipe".equals(kind)) {
                    Long recipeId = Long.parseLong(bestMatch.metadata().get("id").toString());
                    String recipeName = bestMatch.metadata().get("title") != null
                            ? bestMatch.metadata().get("title").toString() : foodName;
                    double calories = extractCaloriesFromText(bestMatch.text(), servings);

                    Map<String, Object> actionData = Map.of(
                            "sourceType", "RECIPE",
                            "sourceId", recipeId,
                            "sourceName", recipeName,
                            "mealType", mealType,
                            "servings", servings,
                            "calories", calories
                    );
                    conversationMemoryService.setPendingAction(
                            conversation, "LOG_MEAL", objectMapper.writeValueAsString(actionData));

                    String answer = String.format(
                            "I found **%s** (approximately %.0f kcal for %.1f serving). Should I add it to your %s log? Reply 'yes' to confirm or 'no' to cancel.",
                            recipeName, calories, servings, mealType.toLowerCase());

                    conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                    conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                    return new AssistantChatResponseDto(answer,
                            List.of("This response is for general informational purposes and does not replace medical advice."),
                            List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian."));

                } else {
                    Long foodId = Long.parseLong(bestMatch.metadata().get("id").toString());
                    String foundFoodName = bestMatch.metadata().get("name") != null
                            ? bestMatch.metadata().get("name").toString() : foodName;
                    double calories = bestMatch.metadata().get("calories") != null
                            ? Double.parseDouble(bestMatch.metadata().get("calories").toString()) : 0.0;

                    Map<String, Object> actionData = Map.of(
                            "sourceType", "FOOD",
                            "sourceId", foodId,
                            "sourceName", foundFoodName,
                            "mealType", mealType,
                            "quantity", 100.0,
                            "unitType", "GRAM",
                            "calories", calories
                    );
                    conversationMemoryService.setPendingAction(
                            conversation, "LOG_MEAL", objectMapper.writeValueAsString(actionData));

                    String answer = String.format(
                            "I found **%s** (%.0f kcal per 100g). Should I add 100g to your %s log? Reply 'yes' to confirm or 'no' to cancel.",
                            foundFoodName, calories, mealType.toLowerCase());

                    conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                    conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                    return new AssistantChatResponseDto(answer,
                            List.of("This response is for general informational purposes and does not replace medical advice."),
                            List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian."));
                }
            }

            String answer = String.format(
                    "I couldn't find '%s' in my database. Could you be more specific or try a different name?", foodName);
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return new AssistantChatResponseDto(answer,
                    List.of("This response is for general informational purposes and does not replace medical advice."),
                    List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian."));

        } catch (Exception e) {
            return handleNormalChat(userEmail, message, conversation, historyBlock);
        }
    }

    // ── PERSONAL QUERY ──────────────────────────────────────────────

    private AssistantChatResponseDto handlePersonalQuery(
            String userEmail, String message, Conversation conversation, String historyBlock) {

        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);
        String dailyNutritionContext = buildDailyNutritionContext(userEmail);
        String dailyHealthContext = userDailyHealthContextService.buildTodayHealthSummary();

        String userPrompt = """
                === USER PROFILE ===
                %s
                
                %s

                %s
                
                === CONVERSATION HISTORY ===
                %s
                
                === USER QUESTION ===
                %s
                
                Answer based on the user's profile and today's nutrition log only.
                Be specific with numbers. Calculate remaining calories if asked.
        """.formatted(
                profileContext,
                dailyNutritionContext,
                dailyHealthContext,
                historyBlock.isBlank() ? "(No previous conversation)" : historyBlock,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return new AssistantChatResponseDto(
                answer,
                List.of("This response is for general informational purposes and does not replace medical advice."),
                List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
        );
    }

    // ── NORMAL CHAT (RAG) ───────────────────────────────────────────

    private AssistantChatResponseDto handleNormalChat(
            String userEmail, String message, Conversation conversation, String historyBlock) {

        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);
        String dailyNutritionContext = buildDailyNutritionContext(userEmail);
        String dailyHealthContext = userDailyHealthContextService.buildTodayHealthSummary();

        List<DocumentMatch> matches = vectorService.findRelevant(message.trim(), 5);
        String ragContext = buildRagContext(matches);

        String userPrompt = """
                === USER PROFILE ===
                %s
                
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
                dailyHealthContext,
                historyBlock.isBlank() ? "(No previous conversation)" : historyBlock,
                ragContext,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return new AssistantChatResponseDto(
                answer,
                List.of("This response is for general informational purposes and does not replace medical advice."),
                List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
        );
    }

    private AssistantChatResponseDto handleFridgeQuery(
            String userEmail, String message, Conversation conversation, String historyBlock) {

        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);
        String dailyNutritionContext = buildDailyNutritionContext(userEmail);
        String dailyHealthContext = userDailyHealthContextService.buildTodayHealthSummary();
        String fridgeContext = userFridgeContextService.buildFridgeContext(userEmail);

        String userPrompt = """
                === USER PROFILE ===
                %s

                %s

                %s

                %s

                === CONVERSATION HISTORY ===
                %s

                === USER QUESTION ===
                %s

                Answer using the fridge items as the primary constraint.
                If the user asks what they can cook, prioritize ideas that mostly use the listed fridge items.
                If important ingredients are missing, say so clearly.
                If the fridge is empty, say that directly and suggest what to buy.
                Tailor all suggestions to the user's profile and restrictions.
        """.formatted(
                profileContext,
                dailyNutritionContext,
                dailyHealthContext,
                fridgeContext,
                historyBlock.isBlank() ? "(No previous conversation)" : historyBlock,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return new AssistantChatResponseDto(
                answer,
                List.of("This response is for general informational purposes and does not replace medical advice."),
                List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
        );
    }

    @SuppressWarnings("unchecked")
    private AssistantChatResponseDto handleFridgeAddIntent(
            String userEmail, String message, String intentJson,
            Conversation conversation, String historyBlock) {

        try {
            Map<String, Object> intentData = objectMapper.readValue(intentJson, Map.class);
            String foodName = (String) intentData.get("food_name");
            double quantity = ((Number) intentData.getOrDefault("quantity", 100.0)).doubleValue();
            String unitType = (String) intentData.getOrDefault("unit_type", "GRAM");

            List<DocumentMatch> matches = vectorService.findRelevant(foodName, 5);
            DocumentMatch bestMatch = matches.stream()
                    .filter(m -> m.distance() <= RELEVANCE_THRESHOLD)
                    .filter(m -> "food".equals(m.metadata().get("kind")))
                    .findFirst()
                    .orElse(null);

            if (bestMatch == null) {
                String answer = String.format(
                        "I couldn't find '%s' in my food database. Could you try a more specific product name?",
                        foodName
                );
                conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                return new AssistantChatResponseDto(answer,
                        List.of("This response is for general informational purposes and does not replace medical advice."),
                        List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian."));
            }

            Long foodId = Long.parseLong(bestMatch.metadata().get("id").toString());
            String foundFoodName = bestMatch.metadata().get("name") != null
                    ? bestMatch.metadata().get("name").toString() : foodName;

            Map<String, Object> actionData = Map.of(
                    "sourceType", "FRIDGE",
                    "sourceId", foodId,
                    "sourceName", foundFoodName,
                    "quantity", quantity,
                    "unitType", normalizeUnitType(unitType)
            );
            conversationMemoryService.setPendingAction(
                    conversation, "FRIDGE_ADD_ITEM", objectMapper.writeValueAsString(actionData));

            String answer = String.format(
                    "I found **%s**. Should I add %s %s to your fridge? Reply 'yes' to confirm or 'no' to cancel.",
                    foundFoodName,
                    formatCompactNumber(quantity),
                    "PIECE".equals(normalizeUnitType(unitType))
                            ? "piece" + (quantity == 1 ? "" : "s")
                            : "g"
            );

            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return new AssistantChatResponseDto(answer,
                    List.of("This response is for general informational purposes and does not replace medical advice."),
                    List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian."));
        } catch (Exception e) {
            return handleNormalChat(userEmail, message, conversation, historyBlock);
        }
    }

    // ── HELPERS ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String extractIntent(String intentJson) {
        try {
            String cleaned = intentJson.trim()
                    .replaceAll("```json", "")
                    .replaceAll("```", "")
                    .trim();
            Map<String, Object> map = objectMapper.readValue(cleaned, Map.class);
            return (String) map.getOrDefault("intent", "OTHER");
        } catch (Exception e) {
            return "OTHER";
        }
    }

    private double extractCaloriesFromText(String text, double servings) {
        try {
            String[] lines = text.split("\n");
            for (String line : lines) {
                if (line.toLowerCase().contains("kcal")) {
                    String[] parts = line.split("\\s+");
                    for (int i = 0; i < parts.length; i++) {
                        if (parts[i].toLowerCase().contains("kcal") && i > 0) {
                            double cal = Double.parseDouble(parts[i - 1].replaceAll("[^0-9.]", ""));
                            return cal * servings;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return 0.0;
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

    private String normalizeUnitType(String unitType) {
        if (unitType == null) {
            return "GRAM";
        }
        String normalized = unitType.trim().replace('-', '_').replace(' ', '_').toUpperCase();
        return "PIECE".equals(normalized) ? "PIECE" : "GRAM";
    }

    private String formatCompactNumber(double value) {
        if (Math.floor(value) == value) {
            return String.valueOf((int) value);
        }
        return String.format(java.util.Locale.US, "%.1f", value);
    }
}
