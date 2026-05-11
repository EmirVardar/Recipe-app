package com.student.recipe.service.assistant;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
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
            Sen kişiselleştirilmiş bir beslenme asistanısın.
            Her zaman Türkçe cevap ver.
            
            KESIN KURALLAR:
            - Cevabını her zaman verilen kullanıcı profiline göre kişiselleştir.
            - Kullanıcının alerjileri varsa o içerikleri içeren tarifleri ASLA önerme.
            - Kullanıcının intoleransları varsa o içeriklerden kaçın.
            - Önerilerini her zaman kullanıcının hedefi ve beslenme tipine uygun ver.
            - Birincil kaynak olarak CONTEXT bölümünü kullan. Tarif detayları uydurma.
            - Tıbbi teşhis veya ilaç doz önerisi verme.
            - Klinik açıdan acil durum varsa doktora başvurmasını öner.
            - Mesajlar arası bağlamı korumak için konuşma geçmişini kullan.
            - Kişiselleştirilmiş günlük geri bildirim için BUGÜNKÜ BESLENME KAYDI bölümünü kullan.
            - Cevaplari kisa, net ve dogrudan ver.
            - Kullanici istemedikce uzun aciklama, madde listesi veya gereksiz uyarilar ekleme.
            """;

    private static final String INTENT_SYSTEM_PROMPT = """
            Sen bir beslenme uygulaması için intent tespit edicisin.
            Kullanıcı mesajını analiz et ve SADECE bir JSON nesnesi döndür, başka hiçbir şey döndürme.
            
            Kullanıcı bir şey yediğini/içtiğini/tükettiğini söylüyorsa şunu döndür:
            {
              "intent": "LOG_MEAL",
              "food_name": "<extracted food name>",
              "meal_type": "<BREAKFAST|LUNCH|DINNER|SNACK>",
              "servings": 1.0
            }
            
            Kullanıcı kendi beslenme verileri, günlük ilerleme, alınan kalori, kalan kalori,
            bugün ne yediği veya durumunun nasıl olduğu hakkında soruyorsa şunu döndür:
            {
              "intent": "PERSONAL_QUERY"
            }

            Kullanıcı buzdolabında ne olduğunu, hangi malzemelerin kaldığını,
            evdeki malzemelerle ne yapabileceğini veya buzdolabına göre tarif fikri istiyorsa şunu döndür:
            {
              "intent": "FRIDGE_QUERY"
            }

            Kullanıcı buzdolabına bir şey eklemek istiyorsa şunu döndür:
            {
              "intent": "FRIDGE_ADD_ITEM",
              "food_name": "<extracted food name>",
              "quantity": 1.0,
              "unit_type": "<GRAM|PIECE>"
            }
            
            Diğer her şey için (tarif önerileri, yemek soruları, genel beslenme tavsiyesi) şunu döndür:
            {
              "intent": "OTHER"
            }
            
            meal_type kuralları:
            - sabah/kahvaltı → BREAKFAST
            - öğle → LUNCH
            - akşam/gece → DINNER
            - ara öğün/diğer → SNACK
            - belirtilmemişse → DINNER
            
            SADECE JSON döndür, açıklama yazma.
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Kullanici bulunamadi"))
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

        String normalized = normalizeConfirmationInput(message);
        boolean confirmed = normalized.equals("yes") || normalized.equals("yeah") ||
                normalized.equals("yep") || normalized.equals("ok") ||
                normalized.equals("okay") || normalized.equals("sure") ||
                normalized.equals("add it") || normalized.equals("confirm") ||
                normalized.equals("evet") || normalized.equals("onayla") ||
                normalized.equals("ekle") || normalized.equals("tamam") ||
                normalized.startsWith("evet ") || normalized.startsWith("tamam ") ||
                normalized.startsWith("onayla ") || normalized.startsWith("ekle ");

        boolean rejected = normalized.equals("no") || normalized.equals("nope") ||
                normalized.equals("cancel") || normalized.equals("don't") ||
                normalized.equals("skip") || normalized.equals("hayir") ||
                normalized.equals("iptal") || normalized.equals("vazgec") ||
                normalized.startsWith("hayir ") || normalized.startsWith("iptal ");

        if (confirmed) {
            String answer = executePendingAction(userEmail, conversation);
            conversationMemoryService.clearPendingAction(conversation);
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);
        }

        if (rejected) {
            conversationMemoryService.clearPendingAction(conversation);
            String answer = "Tamam, bu islemi yapmayacagim. Baska bir seye ihtiyacin olursa yaz.";
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);
        }

        String answer = "Onayini bekliyorum. Onaylamak icin 'evet', iptal etmek icin 'hayir' yaz.";
        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
        return response(answer);
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

                return String.format("✓ **%s** buzdolabina eklendi (%s %s).",
                        sourceName,
                        formatCompactNumber(quantity),
                        "PIECE".equals(unitType) ? "adet" : "g");
            }
        } catch (Exception ignored) {
            return "Uzgunum, bu buzdolabi islemini tamamlayamadim. Lutfen tekrar dene.";
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

            return String.format("✓ **%s**, %s ogunune eklendi (%.0f kcal). Gunluk toplamlarin guncellendi.",
                    sourceName, mealType.toLowerCase(), calories);

        } catch (Exception e) {
            return "Uzgunum, bunu ogun kaydina ekleyemedim. Lutfen tekrar dene.";
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
                            "**%s** bulundu (%.1f porsiyon icin yaklasik %.0f kcal). Bunu %s ogunune ekleyeyim mi? Onaylamak icin 'evet', iptal etmek icin 'hayir' yaz.",
                            recipeName, calories, servings, mealType.toLowerCase());

                    conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                    conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                    return response(answer);

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
                            "**%s** bulundu (100 g icin %.0f kcal). Bunu %s ogunune 100 g olarak ekleyeyim mi? Onaylamak icin 'evet', iptal etmek icin 'hayir' yaz.",
                            foundFoodName, calories, mealType.toLowerCase());

                    conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                    conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                    return response(answer);
                }
            }

            String answer = String.format(
                    "'%s' veritabanimda bulunamadi. Daha net bir ad yazabilir veya farkli bir isim deneyebilirsin.", foodName);
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);

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
                
                Sadece kullanicinin profiline ve bugunku beslenme kaydina gore cevap ver.
                Sayilar konusunda net ol. Kalan kalori sorulursa hesapla.
        """.formatted(
                profileContext,
                dailyNutritionContext,
                dailyHealthContext,
                historyBlock.isBlank() ? "(Onceki konusma yok)" : historyBlock,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return response(answer);
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
                
                === VERITABANINDAN ILGILI TARIFLER ===
                %s
                
                === USER QUESTION ===
                %s
                
                Yukaridaki baglama gore cevap ver. Cevabi kullanici profiline gore uyarlat.
        """.formatted(
                profileContext,
                dailyNutritionContext,
                dailyHealthContext,
                historyBlock.isBlank() ? "(Onceki konusma yok)" : historyBlock,
                ragContext,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return response(answer);
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

                Cevap verirken birincil kisit olarak buzdolabindaki urunleri kullan.
                Kullanici ne yapabilecegini sorarsa, listelenen urunleri agirlikli kullanan fikirleri one al.
                Onemli malzemeler eksikse bunu acikca belirt.
                Buzdolabi bossa bunu dogrudan soyle ve ne alinabilecegini oner.
                Tum onerileri kullanicinin profiline ve kisitlarina gore uyarlat.
        """.formatted(
                profileContext,
                dailyNutritionContext,
                dailyHealthContext,
                fridgeContext,
                historyBlock.isBlank() ? "(Onceki konusma yok)" : historyBlock,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return response(answer);
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
                        "'%s' yi urun veritabanimda bulamadim. Daha spesifik bir urun adi deneyebilir misin?",
                        foodName
                );
                conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                return response(answer);
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
                    "**%s** bulundu. Buzdolabina %s %s ekleyeyim mi? Onaylamak icin 'evet', iptal etmek icin 'hayir' yaz.",
                    foundFoodName,
                    formatCompactNumber(quantity),
                    "PIECE".equals(normalizeUnitType(unitType))
                            ? "adet"
                            : "g"
            );

            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);
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
                    === BUGUNKU BESLENME KAYDI ===
                    Toplam alinan kalori: %.0f kcal
                    Toplam protein: %.1f g
                    Toplam karbonhidrat: %.1f g
                    Toplam yag: %.1f g
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
            return "(Veritabaninda ilgili tarif bulunamadi.)";
        }

        StringBuilder sb = new StringBuilder();
        int idx = 1;
        for (DocumentMatch match : matches) {
            if (match.distance() > RELEVANCE_THRESHOLD) continue;
            sb.append("--- Tarif ").append(idx++).append(" ---\n");
            sb.append(match.text()).append("\n");

            Object url = match.metadata().get("source_url");
            if (url != null && !url.toString().isBlank()) {
                sb.append("URL: ").append(url).append("\n");
            }
            sb.append("\n");
        }

        if (sb.isEmpty()) {
            return "(Veritabaninda ilgili tarif bulunamadi.)";
        }

        return sb.toString();
    }

    private String formatHistory(List<ConversationMessage> history) {
        if (history == null || history.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (ConversationMessage m : history) {
            String role = m.getRole() == ConversationMessageRole.USER ? "Kullanici" : "Asistan";
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

    private String normalizeConfirmationInput(String message) {
        if (message == null) {
            return "";
        }
        return message
                .trim()
                .toLowerCase(Locale.forLanguageTag("tr"))
                .replaceAll("[.!?,:;]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private AssistantChatResponseDto response(String answer) {
        return new AssistantChatResponseDto(answer);
    }
}
