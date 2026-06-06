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
import com.student.recipe.dto.assistant.AssistantRecipePreviewDto;
import com.student.recipe.dto.assistant.UserAiProfileContextDto;
import com.student.recipe.dto.meal.MealLogItemCreateRequestDto;
import com.student.recipe.dto.meal.RecipeMealLogItemCreateRequestDto;
import com.student.recipe.entity.Conversation;
import com.student.recipe.entity.ConversationMessage;
import com.student.recipe.entity.Recipe;
import com.student.recipe.entity.enums.ConversationMessageRole;
import com.student.recipe.repository.RecipeRepository;
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
            - Kullanıcının o anki mesajdaki açık isteği birincil önceliktir. Kullanıcı özellikle bir yemek, içerik veya tarif istiyorsa önce onu cevapla.
            - Kullanıcının bu mesajda özellikle istemediği, içinde olmasın dediği veya kaçındığını belirttiği içerikler, favori yiyeceklerden ve genel tercihlerden daha yüksek önceliklidir.
            - Alerji bilgisi önemli bir güvenlik bilgisidir. Kullanıcı alerjisi olan bir içerikle ilgili özellikle tarif isterse isteğini reddetme, konuyu değiştirme ve yerine başka ana tarif önermeye çalışma. Önce tam olarak istediği tarifi ver. Tarif bittikten sonra en sonda 1-2 kısa cümleyle alerji nedeniyle bunun kendisi için riskli olabileceğini söyle ve güvenli bir alternatif öner.
            - İntoleranslar ve kaçınılan yiyecekler güçlü tercih/sınırlardır. Kullanıcı özellikle tersini istemediği sürece bu içeriklerden kaçın. Ancak kullanıcı açıkça bu içerikleri isterse ana isteği yine cevapla; ana cevabı değiştirme, sadece en sonda kısa bir uyarı ve daha uygun bir alternatif sun.
            - Tercih edilen yiyecekler ve sevilen içerikler sadece hafif bir yönlendirme sinyalidir; kullanıcının anlık isteğini bastırmaz ve cevabı tek başına belirlemez.
            - Önerilerini her zaman kullanıcının hedefi ve beslenme tipine uygun ver.
            - Birincil kaynak olarak CONTEXT bölümünü kullan. Tarif detayları uydurma.
            - Tıbbi teşhis veya ilaç doz önerisi verme.
            - Klinik açıdan acil durum varsa doktora başvurmasını öner.
            - Mesajlar arası bağlamı korumak için konuşma geçmişini kullan.
            - Kişiselleştirilmiş günlük geri bildirim için BUGÜNKÜ BESLENME KAYDI bölümünü kullan.
            - Cevaplari kisa, net ve dogrudan ver.
            - Kullanici istemedikce uzun aciklama, madde listesi veya gereksiz uyarilar ekleme.
            - Risk veya çelişki varsa şu zorunlu sırayı kullan: 
              1. Önce kullanıcının istediği tarifi veya cevabı ver.
              2. Ardından ayrı bir kısa notla risk uyarısını yaz.
              3. En son tek bir güvenli alternatif öner.
            - Kullanıcı "yumurtalı tarif", "sütlü tarif" gibi açık bir içerik istiyorsa, alerji yüzünden ana cevabı yumurtasız veya sütsüz başka bir tarife çevirme.
            """;

    private static final String INTENT_SYSTEM_PROMPT = """
            Sen bir beslenme uygulaması için intent tespit edicisin.
            Kullanıcı mesajını analiz et ve SADECE bir JSON nesnesi döndür, başka hiçbir şey döndürme.
            
            Kullanıcı bir şey yediğini/içtiğini/tükettiğini söylüyorsa şunu döndür:
            {
              "intent": "LOG_MEAL",
              "food_name": "<sadece yemeğin adı, fiil/miktar/birim içermez, örn: 'kıymalı patates yedim 350 gram' → 'kıymalı patates'>",
              "meal_type": "<BREAKFAST|LUNCH|DINNER|SNACK>",
              "quantity": <miktar sayısı, belirtilmemişse 100>,
              "unit": "<GRAM|PIECE|SERVING>",
              "servings": 1.0
            }

            unit kuralları:
            - gram/g → GRAM
            - adet/tane/parça → PIECE
            - porsiyon/tabak/kase → SERVING
            - belirtilmemişse → GRAM
            
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
              "food_name": "<sadece ürünün adı, fiil/miktar/birim içermez, örn: '10 tane yumurta ekle' → 'yumurta'>",
              "quantity": <kullanıcının belirttiği miktar sayısı, belirtilmemişse 1>,
              "unit_type": "<GRAM|PIECE>"
            }

            unit_type kuralları:
            - gram/g → GRAM
            - adet/tane/parça → PIECE
            - belirtilmemişse → PIECE

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
    private final RecipeRepository recipeRepository;
    private final MealTrackingService mealTrackingService;
    private final UserFridgeService userFridgeService;
    private final UserFridgeContextService userFridgeContextService;
    private final UserDailyHealthContextService userDailyHealthContextService;
    private final DailyCalorieTargetService dailyCalorieTargetService;
    private final ObjectMapper objectMapper;

    public AssistantChatService(
            OpenAiService openAiService,
            UserAiProfileContextService userAiProfileContextService,
            UserAiContextPromptBuilder userAiContextPromptBuilder,
            EmbeddingVectorService vectorService,
            ConversationMemoryService conversationMemoryService,
            UserRepository userRepository,
            RecipeRepository recipeRepository,
            MealTrackingService mealTrackingService,
            UserFridgeService userFridgeService,
            UserFridgeContextService userFridgeContextService,
            UserDailyHealthContextService userDailyHealthContextService,
            DailyCalorieTargetService dailyCalorieTargetService,
            ObjectMapper objectMapper
    ) {
        this.openAiService = openAiService;
        this.userAiProfileContextService = userAiProfileContextService;
        this.userAiContextPromptBuilder = userAiContextPromptBuilder;
        this.vectorService = vectorService;
        this.conversationMemoryService = conversationMemoryService;
        this.userRepository = userRepository;
        this.recipeRepository = recipeRepository;
        this.mealTrackingService = mealTrackingService;
        this.userFridgeService = userFridgeService;
        this.userFridgeContextService = userFridgeContextService;
        this.userDailyHealthContextService = userDailyHealthContextService;
        this.dailyCalorieTargetService = dailyCalorieTargetService;
        this.objectMapper = objectMapper;
    }

    public AssistantChatResponseDto chat(String userEmail, String message) {
        long totalStartNs = System.nanoTime();
        if (message == null || message.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }

        Long userId = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Kullanici bulunamadi"))
                .getId();

        Conversation conversation = conversationMemoryService.getOrCreate(userId, DEFAULT_CONVERSATION_KEY);
        List<ConversationMessage> history = conversationMemoryService.getLastMessages(conversation.getId(), HISTORY_LIMIT);
        String historyBlock = formatHistory(history);

        if ("AWAIT_CUSTOM_MEAL".equals(conversation.getPendingActionType())) {
            return handleAwaitCustomMeal(userEmail, message, conversation);
        }

        if (conversation.getPendingActionType() != null) {
            return handlePendingConfirmation(userEmail, message, conversation, historyBlock);
        }

        if (isConversationMemoryQuery(message.trim())) {
            return handleMemoryQuery(userEmail, message, conversation, historyBlock);
        }

        long intentStartNs = System.nanoTime();
        String intentJson = openAiService.chat(INTENT_SYSTEM_PROMPT, message.trim());
        long intentMs = toMillis(System.nanoTime() - intentStartNs);
        String intent = extractIntent(intentJson);

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

        return handleNormalChat(userEmail, message, conversation, historyBlock, history, totalStartNs, intentMs);
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
                normalized.equals("ekle") || normalized.equals("tamam") || normalized.equals("tamamdır") ||
                normalized.equals("olur") || normalized.equals("tabii") || normalized.equals("elbette") ||
                normalized.startsWith("evet") || normalized.startsWith("tamam") ||
                normalized.startsWith("onayla") || normalized.startsWith("ekle") || normalized.startsWith("olur");

        boolean rejected = normalized.equals("no") || normalized.equals("nope") ||
                normalized.equals("cancel") || normalized.equals("don't") ||
                normalized.equals("skip") || normalized.equals("hayir") || normalized.equals("hayır") ||
                normalized.equals("iptal") || normalized.equals("vazgec") || normalized.equals("istemiyorum") ||
                normalized.startsWith("hayır") || normalized.startsWith("hayir") || normalized.startsWith("iptal") || normalized.startsWith("istemiyorum");

        boolean wantsCustom = normalized.equals("değiştir") || normalized.equals("degistir") ||
                normalized.equals("değiştir") || normalized.startsWith("değiştir") || normalized.startsWith("degistir");

        if (wantsCustom) {
            try {
                String data = conversation.getPendingActionData();
                Map<String, Object> actionData = objectMapper.readValue(data, Map.class);
                String mealType = (String) actionData.get("mealType");
                conversationMemoryService.clearPendingAction(conversation);
                Map<String, Object> awaitData = new java.util.HashMap<>();
                awaitData.put("mealType", mealType != null ? mealType : "DINNER");
                conversationMemoryService.setPendingAction(
                        conversation, "AWAIT_CUSTOM_MEAL", objectMapper.writeValueAsString(awaitData));
            } catch (Exception ignored) {
                conversationMemoryService.clearPendingAction(conversation);
            }
            String answer = "Peki ne yedin? Yediklerini yazarsan tahmini değerleri hesaplayabilirim.";
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);
        }

        if (confirmed) {
            String answer = executePendingAction(userEmail, conversation);
            conversationMemoryService.clearPendingAction(conversation);
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);
        }

        if (rejected) {
            try {
                String data = conversation.getPendingActionData();
                Map<String, Object> actionData = objectMapper.readValue(data, Map.class);
                String sourceType = (String) actionData.get("sourceType");
                String sourceName = (String) actionData.get("sourceName");
                String mealType = (String) actionData.get("mealType");

                // DB'den bulunan bir yemek reddedildiyse LLM tahminine geç
                if (("RECIPE".equals(sourceType) || "FOOD".equals(sourceType)) && sourceName != null && mealType != null) {
                    conversationMemoryService.clearPendingAction(conversation);

                    String macroJson = openAiService.chat("""
                            Kullanıcının tarif ettiği yemek için 1 porsiyon (yaklaşık 300g) besin değerlerini JSON olarak ver.
                            Sadece şu format: {"calories":0,"protein":0,"carbs":0,"fat":0}
                            Sayılar tam sayı olsun. Başka hiçbir şey yazma.
                            """, sourceName);

                    double estCalories = 0, estProtein = 0, estCarbs = 0, estFat = 0;
                    try {
                        Map<String, Object> macros = objectMapper.readValue(macroJson.trim(), Map.class);
                        estCalories = ((Number) macros.getOrDefault("calories", 0)).doubleValue();
                        estProtein  = ((Number) macros.getOrDefault("protein", 0)).doubleValue();
                        estCarbs    = ((Number) macros.getOrDefault("carbs", 0)).doubleValue();
                        estFat      = ((Number) macros.getOrDefault("fat", 0)).doubleValue();
                    } catch (Exception ignored) {}

                    Map<String, Object> newAction = Map.of(
                            "sourceType", "CUSTOM",
                            "sourceName", sourceName,
                            "mealType", mealType,
                            "calories", estCalories,
                            "protein", estProtein,
                            "carbs", estCarbs,
                            "fat", estFat
                    );
                    conversationMemoryService.setPendingAction(
                            conversation, "LOG_MEAL", objectMapper.writeValueAsString(newAction));

                    String answer = String.format(
                            "Anladım, tahmini değerleri hesapladım: **%s** için yaklaşık **%.0f kcal**, %.0fg protein, %.0fg karb, %.0fg yağ. %s öğününe ekleyeyim mi?",
                            sourceName, estCalories, estProtein, estCarbs, estFat, mealTypeForSentence(mealType));
                    conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                    conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                    return response(answer);
                }
            } catch (Exception ignored) {}

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
            } else if ("CUSTOM".equals(sourceType)) {
                double protein = ((Number) actionData.getOrDefault("protein", 0)).doubleValue();
                double carbs   = ((Number) actionData.getOrDefault("carbs", 0)).doubleValue();
                double fat     = ((Number) actionData.getOrDefault("fat", 0)).doubleValue();
                mealTrackingService.addCustomMealItem(userEmail, sourceName, mealType, calories, protein, carbs, fat);
            } else {
                Long foodId = ((Number) actionData.get("sourceId")).longValue();
                double quantity = ((Number) actionData.get("quantity")).doubleValue();
                String unitType = (String) actionData.get("unitType");
                mealTrackingService.addMealItem(userEmail, new MealLogItemCreateRequestDto(
                        LocalDate.now(), mealType, foodId, quantity, unitType
                ));
            }

            return String.format("✓ **%s**, %s öğününe eklendi (%.0f kcal). Günlük toplamların güncellendi.",
                    sourceName, mealTypeForSentence(mealType), calories);

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
            double quantity = ((Number) intentData.getOrDefault("quantity", 100)).doubleValue();
            String unit = (String) intentData.getOrDefault("unit", "GRAM");

            String mealSearchQuery = expandFoodQuery(foodName);
            List<DocumentMatch> matches = vectorService.findRelevant(mealSearchQuery, 5).matches();
            DocumentMatch bestMatch = matches.stream()
                    .filter(m -> m.distance() <= 0.50)
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
                            "**%s** bulundu (%.1f porsiyon için yaklaşık %.0f kcal). %s öğününe ekleyeyim mi? Onaylamak için 'evet', farklı bir şey girmek için 'değiştir' yaz veya söyle.",
                            recipeName, servings, calories, mealTypeForSentence(mealType));

                    conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                    conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                    return response(answer);

                } else {
                    Long foodId = Long.parseLong(bestMatch.metadata().get("id").toString());
                    String foundFoodName = bestMatch.metadata().get("name") != null
                            ? bestMatch.metadata().get("name").toString() : foodName;
                    double caloriesPer100g = bestMatch.metadata().get("calories") != null
                            ? Double.parseDouble(bestMatch.metadata().get("calories").toString()) : 0.0;
                    double adjustedCalories = "GRAM".equals(unit)
                            ? caloriesPer100g * quantity / 100.0
                            : caloriesPer100g;

                    Map<String, Object> actionData = Map.of(
                            "sourceType", "FOOD",
                            "sourceId", foodId,
                            "sourceName", foundFoodName,
                            "mealType", mealType,
                            "quantity", quantity,
                            "unitType", unit,
                            "calories", adjustedCalories
                    );
                    conversationMemoryService.setPendingAction(
                            conversation, "LOG_MEAL", objectMapper.writeValueAsString(actionData));

                    String unitLabel = "GRAM".equals(unit) ? "g" : "PIECE".equals(unit) ? "adet" : "porsiyon";
                    String answer = String.format(
                            "**%s** bulundu (%.0f %s için %.0f kcal). %s öğününe ekleyeyim mi? Onaylamak için 'evet', farklı bir şey girmek için 'değiştir' yaz veya söyle.",
                            foundFoodName, quantity, unitLabel, adjustedCalories, mealTypeForSentence(mealType));

                    conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
                    conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
                    return response(answer);
                }
            }

            // DB'de bulunamadı → LLM'den kalori tahmini al
            String quantityContext = String.format("%.0f %s", quantity, "GRAM".equals(unit) ? "gram" : "PIECE".equals(unit) ? "adet" : "porsiyon");
            String macroJson = openAiService.chat(String.format("""
                    Kullanıcının tarif ettiği yemek için %s miktarı besin değerlerini JSON olarak ver.
                    Sadece şu format: {"calories":0,"protein":0,"carbs":0,"fat":0}
                    Sayılar tam sayı olsun. Başka hiçbir şey yazma.
                    """, quantityContext), foodName);

            double estCalories = 0, estProtein = 0, estCarbs = 0, estFat = 0;
            try {
                Map<String, Object> macros = objectMapper.readValue(macroJson.trim(), Map.class);
                estCalories = ((Number) macros.getOrDefault("calories", 0)).doubleValue();
                estProtein  = ((Number) macros.getOrDefault("protein", 0)).doubleValue();
                estCarbs    = ((Number) macros.getOrDefault("carbs", 0)).doubleValue();
                estFat      = ((Number) macros.getOrDefault("fat", 0)).doubleValue();
            } catch (Exception ignored) {}

            Map<String, Object> actionData = Map.of(
                    "sourceType", "CUSTOM",
                    "sourceName", foodName,
                    "mealType", mealType,
                    "calories", estCalories,
                    "protein", estProtein,
                    "carbs", estCarbs,
                    "fat", estFat
            );
            conversationMemoryService.setPendingAction(
                    conversation, "LOG_MEAL", objectMapper.writeValueAsString(actionData));

            String answer = String.format(
                    "**%s** veritabanımda yok ama tahmini değerleri hesapladım: yaklaşık **%.0f kcal**, %.0fg protein, %.0fg karbonhidrat, %.0fg yağ. %s öğününe ekleyeyim mi?",
                    foodName, estCalories, estProtein, estCarbs, estFat, mealTypeForSentence(mealType));
            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);

        } catch (Exception e) {
            List<ConversationMessage> history = conversationMemoryService.getLastMessages(conversation.getId(), HISTORY_LIMIT);
            return handleNormalChat(userEmail, message, conversation, historyBlock, history, System.nanoTime(), -1L);
        }
    }

    // ── PERSONAL QUERY ──────────────────────────────────────────────

    private AssistantChatResponseDto handlePersonalQuery(
            String userEmail, String message, Conversation conversation, String historyBlock) {

        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);
        String dailyNutritionContext = buildDailyNutritionContext(userEmail, context);
        String dailyHealthContext = userDailyHealthContextService.buildTodayHealthSummary();

        String userPrompt = """
                === KULLANICI PROFİLİ ===
                %s
                
                %s

                %s
                
                === KONUŞMA GEÇMİŞİ ===
                %s
                
                === KULLANICI SORUSU ===
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
            String userEmail, String message, Conversation conversation, String historyBlock, List<ConversationMessage> history,
            long totalStartNs, long intentMs) {

        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);
        String dailyNutritionContext = buildDailyNutritionContext(userEmail, context);
        String dailyHealthContext = userDailyHealthContextService.buildTodayHealthSummary();

        String ragQuery = buildRagQuery(message.trim(), history);
        long normalizationStartNs = System.nanoTime();
        String searchQuery = openAiService.chat(
                "Kullanıcının mesajından sadece aranacak yemek veya tarif adını çıkar. Sadece ismi yaz, başka hiçbir şey yazma. Örnek: 'mercimek çorbası tarifi ver' → 'mercimek çorbası', 'canım pilav çekti bana pilav tarifi ver' → 'pilav'",
                ragQuery
        );
        long normalizationMs = toMillis(System.nanoTime() - normalizationStartNs);
        String finalSearchQuery = (searchQuery == null || searchQuery.isBlank() || searchQuery.length() > 100)
                ? ragQuery
                : searchQuery.trim();
        EmbeddingVectorService.RetrievalPerfResult retrieval = vectorService.findRelevant(finalSearchQuery, 10);
        List<DocumentMatch> matches = retrieval.matches();
        List<DocumentMatch> recipeMatches = matches.stream()
                .filter(m -> "recipe".equals(m.metadata().get("kind")))
                .filter(m -> m.distance() <= RELEVANCE_THRESHOLD)
                .limit(5)
                .toList();

        List<DocumentMatch> finalMatches = recipeMatches.isEmpty()
                ? matches.stream()
                .filter(m -> "food".equals(m.metadata().get("kind")))
                .filter(m -> m.distance() <= RELEVANCE_THRESHOLD)
                .limit(5)
                .toList()
                : recipeMatches;

        String ragContext = buildRagContext(finalMatches);

        String userPrompt = """
                === KULLANICI PROFİLİ ===
                %s
                
                %s

                %s
                
                === KONUŞMA GEÇMİŞİ ===
                %s
                
                === VERİTABANINDAN İLGİLİ TARİFLER ===
                %s
                
                === KULLANICI SORUSU ===
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

        long answerStartNs = System.nanoTime();
        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);
        long answerMs = toMillis(System.nanoTime() - answerStartNs);
        String answerForUser = appendSourceLine(stripSourceLine(answer), finalMatches);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, stripSourceLine(answerForUser));
        System.out.println(
                "PERF_RAG_SUMMARY " +
                "intentMs=" + intentMs +
                " queryNormalizationMs=" + normalizationMs +
                " embeddingMs=" + retrieval.embeddingMs() +
                " chromaQueryMs=" + retrieval.chromaQueryMs() +
                " answerGenerationMs=" + answerMs +
                " totalMs=" + toMillis(System.nanoTime() - totalStartNs)
        );

        return response(answerForUser, null, buildRecipePreview(finalMatches));
    }

    private long toMillis(long durationNs) {
        return durationNs / 1_000_000L;
    }

    // ── FRIDGE QUERY ────────────────────────────────────────────────

    private AssistantChatResponseDto handleFridgeQuery(
            String userEmail, String message, Conversation conversation, String historyBlock) {

        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);
        String dailyNutritionContext = buildDailyNutritionContext(userEmail, context);
        String dailyHealthContext = userDailyHealthContextService.buildTodayHealthSummary();
        String fridgeContext = userFridgeContextService.buildFridgeContext(userEmail);

        String userPrompt = """
                === KULLANICI PROFİLİ ===
                %s

                %s

                %s

                %s

                === KONUŞMA GEÇMİŞİ ===
                %s

                === KULLANICI SORUSU ===
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

    // ── FRIDGE ADD INTENT ───────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private AssistantChatResponseDto handleFridgeAddIntent(
            String userEmail, String message, String intentJson,
            Conversation conversation, String historyBlock) {

        try {
            Map<String, Object> intentData = objectMapper.readValue(intentJson, Map.class);
            String foodName = (String) intentData.get("food_name");
            double quantity = ((Number) intentData.getOrDefault("quantity", 100.0)).doubleValue();
            String unitType = (String) intentData.getOrDefault("unit_type", "GRAM");

            String searchQuery = expandFoodQuery(foodName);

            List<DocumentMatch> matches = vectorService.findRelevant(searchQuery, 5).matches();
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
                    "PIECE".equals(normalizeUnitType(unitType)) ? "adet" : "g"
            );

            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);

        } catch (Exception e) {
            List<ConversationMessage> history = conversationMemoryService.getLastMessages(conversation.getId(), HISTORY_LIMIT);
            return handleNormalChat(userEmail, message, conversation, historyBlock, history, System.nanoTime(), -1L);
        }
    }

    private AssistantChatResponseDto handleMemoryQuery(
            String userEmail, String message, Conversation conversation, String historyBlock) {

        String userPrompt = """
                === KONUŞMA GEÇMİŞİ ===
                %s

                === KULLANICI SORUSU ===
                %s

                Yalnızca konuşma geçmişinde geçenlere dayan.
                Geçmişte yoksa açıkça 'Bu konuşmada bunu göremiyorum' de.
                """.formatted(
                historyBlock.isBlank() ? "(Önceki konuşma yok)" : historyBlock,
                message.trim()
        );

        String answer = openAiService.chat(SYSTEM_PROMPT, userPrompt);

        conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
        conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);

        return response(answer);
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


    private String translateMealType(String mealType) {
        if (mealType == null) return "";
        return switch (mealType) {
            case "BREAKFAST" -> "Kahvaltı";
            case "LUNCH" -> "Öğle Yemeği";
            case "DINNER" -> "Akşam Yemeği";
            case "SNACK" -> "Ara Öğün";
            default -> mealType;
        };
    }

    private String mealTypeForSentence(String mealType) {
        if (mealType == null) return "";
        return switch (mealType) {
            case "BREAKFAST" -> "kahvaltı";
            case "LUNCH" -> "öğle";
            case "DINNER" -> "akşam";
            case "SNACK" -> "ara";
            default -> mealType;
        };
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

    private String buildDailyNutritionContext(String userEmail, UserAiProfileContextDto profileContext) {
        try {
            var dailyMeals = mealTrackingService.getDailyMeals(userEmail, null);
            if (dailyMeals == null) return "";

            double consumedCalories = dailyMeals.totalCalories() != null ? dailyMeals.totalCalories() : 0.0;
            double consumedProtein = dailyMeals.totalProtein() != null ? dailyMeals.totalProtein() : 0.0;
            double consumedCarbs = dailyMeals.totalCarbs() != null ? dailyMeals.totalCarbs() : 0.0;
            double consumedFat = dailyMeals.totalFat() != null ? dailyMeals.totalFat() : 0.0;
            UserDailyHealthContextService.TodayHealthStats todayHealthStats = userDailyHealthContextService.getTodayHealthStats();
            double burnedCalories = todayHealthStats != null ? todayHealthStats.burnedCalories() : 0.0;
            DailyCalorieTargetService.DailyCalorieSummary calorieSummary =
                    dailyCalorieTargetService.summarize(profileContext, consumedCalories, burnedCalories);

            StringBuilder sb = new StringBuilder();
            sb.append(String.format("""
                    === BUGUNKU BESLENME KAYDI ===
                    Toplam alinan kalori: %.0f kcal
                    Toplam protein: %.1f g
                    Toplam karbonhidrat: %.1f g
                    Toplam yag: %.1f g
                    """,
                    consumedCalories,
                    consumedProtein,
                    consumedCarbs,
                    consumedFat
            ));

            if (calorieSummary.targetCalories() != null) {
                sb.append(String.format("""
                        Gunluk tahmini kalori hedefi: %d kcal
                        Bugunku yakilan aktif kalori: %.0f kcal
                        Bugunku net kalori (alinan - yakilan): %.0f kcal
                        Hedefe gore kalan kalori: %.0f kcal
                        """,
                        calorieSummary.targetCalories(),
                        calorieSummary.burnedCalories(),
                        calorieSummary.netCalories(),
                        calorieSummary.remainingCalories() != null ? calorieSummary.remainingCalories() : 0.0
                ));

                if (calorieSummary.suggestedExtraSteps() != null) {
                    sb.append(String.format(
                            "Bugun hedefin uzerindesin. Dengelemek icin tahmini ek adim ihtiyaci: %d adim%n",
                            calorieSummary.suggestedExtraSteps()
                    ));
                }
            }

            if (dailyMeals.meals() != null) {
                for (var meal : dailyMeals.meals()) {
                    sb.append(translateMealType(meal.mealType())).append(":\n");
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
        StringBuilder sourcesSb = new StringBuilder();
        int idx = 1;

        for (DocumentMatch match : matches) {
            if (match.distance() > RELEVANCE_THRESHOLD) continue;
            sb.append("--- Tarif ").append(idx).append(" ---\n");
            sb.append(match.text()).append("\n");

            String kind = match.metadata().get("kind") != null
                    ? match.metadata().get("kind").toString() : "";
            String title = match.metadata().get("title") != null
                    ? match.metadata().get("title").toString() : "";
            String name = match.metadata().get("name") != null
                    ? match.metadata().get("name").toString() : "";

            if ("recipe".equals(kind) && !title.isBlank()) {
                sourcesSb.append("📖 ").append(title).append(" (tarif veritabanı)\n");
            } else if ("food".equals(kind) && !name.isBlank()) {
                sourcesSb.append("🥗 ").append(name).append(" (ürün veritabanı)\n");
            }

            sb.append("\n\n");
            idx++;
        }

        if (sb.isEmpty()) {
            return "(Veritabaninda ilgili tarif bulunamadi.)";
        }

        if (sourcesSb.length() > 0) {
            sb.append("--- KULLANILAN KAYNAKLAR ---\n");
            sb.append(sourcesSb);
        }

        return sb.toString();
    }

    private String appendSourceLine(String answer, List<DocumentMatch> matches) {
        String sourceLabel = resolveSourceLabel(matches);
        if (sourceLabel == null || sourceLabel.isBlank()) {
            return answer;
        }
        return answer + "\n\nKaynak: " + sourceLabel;
    }

    private String resolveSourceLabel(List<DocumentMatch> matches) {
        if (matches == null || matches.isEmpty()) {
            return null;
        }

        for (DocumentMatch match : matches) {
            if (match == null || match.distance() > RELEVANCE_THRESHOLD || match.metadata() == null) {
                continue;
            }

            String kind = match.metadata().get("kind") != null
                    ? match.metadata().get("kind").toString() : "";
            String title = match.metadata().get("title") != null
                    ? match.metadata().get("title").toString() : "";
            String name = match.metadata().get("name") != null
                    ? match.metadata().get("name").toString() : "";

            if ("recipe".equals(kind) && !title.isBlank()) {
                return "📖 " + title + " (tarif veritabanı)";
            }
            if ("food".equals(kind) && !name.isBlank()) {
                return "🥗 " + name + " (ürün veritabanı)";
            }
        }

        return null;
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
        if (unitType == null) return "GRAM";
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
        if (message == null) return "";
        return message
                .trim()
                .toLowerCase(Locale.forLanguageTag("tr"))
                .replaceAll("[.!?,:;]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean isConversationMemoryQuery(String q) {
        if (q == null) return false;
        String s = q.toLowerCase(Locale.forLanguageTag("tr"));
        return s.contains("az önce")
                || s.contains("daha önce")
                || s.contains("ne demiştim")
                || s.contains("ne demiştin")
                || s.contains("ne söyledin")
                || s.contains("hatırlıyor musun")
                || s.contains("bir önceki mesaj")
                || s.contains("önceki mesaj")
                || s.contains("bu konuşmada");
    }

    private boolean isFollowUpQuery(String q) {
        if (q == null) return false;
        String s = q.trim().toLowerCase(Locale.forLanguageTag("tr"));
        if (s.isBlank()) return false;

        int wc = s.split("\\s+").length;
        if (wc <= 4) return true;

        return s.startsWith("peki")
                || s.startsWith("ee")
                || s.startsWith("tamam")
                || s.contains("bunun")
                || s.contains("onun")
                || s.contains("o tarif")
                || s.contains("bu tarif")
                || s.contains("kalorisi")
                || s.contains("malzemeleri")
                || s.contains("nasıl yapılır")
                || s.contains("nasil yapilir");
    }

    private String buildRagQuery(String userQuery, List<ConversationMessage> history) {
        if (!isFollowUpQuery(userQuery)) return userQuery;
        if (history == null || history.isEmpty()) return userQuery;

        String lastUser = "";
        String lastAssistant = "";

        for (int i = history.size() - 1; i >= 0; i--) {
            ConversationMessage m = history.get(i);
            if (m.getRole() == ConversationMessageRole.ASSISTANT && lastAssistant.isBlank()) {
                String c = m.getContent();
                lastAssistant = (c != null && c.length() > 200) ? c.substring(0, 200) : (c != null ? c : "");
            } else if (m.getRole() == ConversationMessageRole.USER && lastUser.isBlank()) {
                String c = m.getContent();
                lastUser = (c != null && c.length() > 120) ? c.substring(0, 120) : (c != null ? c : "");
            }
            if (!lastUser.isBlank() && !lastAssistant.isBlank()) break;
        }

        String hint = (lastUser + " " + lastAssistant).trim();
        if (hint.isBlank()) return userQuery;
        return hint + " " + userQuery;
    }

    private String expandFoodQuery(String userTerm) {
        String expanded = openAiService.chat(
                """
                Kullanıcının yazdığı gıda adını, USDA besin veritabanındaki ham/işlenmemiş malzeme adına çevir.
                Kural: Her zaman en sade, çiğ/taze halini tercih et. Yemek, çorba, sos, hazır ürün adı yazma.
                Örnekler:
                - domates → çiğ domates
                - elma → çiğ elma
                - tavuk → çiğ tavuk göğsü
                - yumurta → çiğ yumurta
                - ekmek → ekmek
                - makarna → makarna, çiğ
                Sadece dönüştürülmüş ismi yaz, başka hiçbir şey yazma.
                """,
                userTerm
        );
        return (expanded == null || expanded.isBlank() || expanded.length() > 80)
                ? userTerm
                : expanded.trim();
    }

    @SuppressWarnings("unchecked")
    private AssistantChatResponseDto handleAwaitCustomMeal(
            String userEmail, String message, Conversation conversation) {
        try {
            String data = conversation.getPendingActionData();
            Map<String, Object> awaitData = objectMapper.readValue(data, Map.class);
            String mealType = (String) awaitData.getOrDefault("mealType", "DINNER");

            conversationMemoryService.clearPendingAction(conversation);

            String extracted = openAiService.chat(
                    "Kullanıcının mesajından sadece yemeğin adını çıkar. Fiil, miktar, birim, zaman ifadesi içermemeli. Sadece yemek adını yaz, başka hiçbir şey yazma.",
                    message.trim());
            String foodName = (extracted != null && !extracted.isBlank() && extracted.length() < 100)
                    ? extracted.trim() : message.trim();
            String macroJson = openAiService.chat("""
                    Kullanıcının tarif ettiği yemek için 1 porsiyon (yaklaşık 300g) besin değerlerini JSON olarak ver.
                    Sadece şu format: {"calories":0,"protein":0,"carbs":0,"fat":0}
                    Sayılar tam sayı olsun. Başka hiçbir şey yazma.
                    """, foodName);

            double estCalories = 0, estProtein = 0, estCarbs = 0, estFat = 0;
            try {
                Map<String, Object> macros = objectMapper.readValue(macroJson.trim(), Map.class);
                estCalories = ((Number) macros.getOrDefault("calories", 0)).doubleValue();
                estProtein  = ((Number) macros.getOrDefault("protein", 0)).doubleValue();
                estCarbs    = ((Number) macros.getOrDefault("carbs", 0)).doubleValue();
                estFat      = ((Number) macros.getOrDefault("fat", 0)).doubleValue();
            } catch (Exception ignored) {}

            Map<String, Object> actionData = Map.of(
                    "sourceType", "CUSTOM",
                    "sourceName", foodName,
                    "mealType", mealType,
                    "calories", estCalories,
                    "protein", estProtein,
                    "carbs", estCarbs,
                    "fat", estFat
            );
            conversationMemoryService.setPendingAction(
                    conversation, "LOG_MEAL", objectMapper.writeValueAsString(actionData));

            String answer = String.format(
                    "**%s** için tahmini: **%.0f kcal**, %.0fg protein, %.0fg karb, %.0fg yağ. %s öğününe ekleyeyim mi? Onaylamak için 'evet', iptal için 'hayır' yaz veya söyle.",
                    foodName, estCalories, estProtein, estCarbs, estFat, mealTypeForSentence(mealType));

            conversationMemoryService.append(conversation, ConversationMessageRole.USER, message.trim());
            conversationMemoryService.append(conversation, ConversationMessageRole.ASSISTANT, answer);
            return response(answer);

        } catch (Exception e) {
            conversationMemoryService.clearPendingAction(conversation);
            String answer = "Bir hata oluştu, tekrar dener misin?";
            return response(answer);
        }
    }

    private String stripSourceLine(String answer) {
        if (answer == null) return "";
        return answer
                .replaceAll("(?im)^\\s*Kaynak\\s*:.*$", "")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    private AssistantChatResponseDto response(String answer) {
        return new AssistantChatResponseDto(answer);
    }

    private AssistantChatResponseDto response(String answer, List<String> quickReplies) {
        return new AssistantChatResponseDto(answer, quickReplies, null);
    }

    private AssistantChatResponseDto response(String answer, List<String> quickReplies, AssistantRecipePreviewDto recipePreview) {
        return new AssistantChatResponseDto(answer, quickReplies, recipePreview);
    }

    private AssistantRecipePreviewDto buildRecipePreview(List<DocumentMatch> matches) {
        for (DocumentMatch match : matches) {
            Object kind = match.metadata().get("kind");
            Object title = match.metadata().get("title");
            if (!"recipe".equals(kind) || title == null) {
                continue;
            }

            String recipeTitle = title.toString().trim();
            if (recipeTitle.isBlank()) {
                continue;
            }

            Recipe recipe = findRecipeByTitle(recipeTitle);
            if (recipe != null) {
                return new AssistantRecipePreviewDto(
                        recipe.getId(),
                        recipe.getTitleTr() != null && !recipe.getTitleTr().isBlank() ? recipe.getTitleTr() : recipe.getTitle(),
                        recipe.getImage()
                );
            }
        }

        return null;
    }

    private Recipe findRecipeByTitle(String recipeTitle) {
        List<Recipe> exactMatches = recipeRepository.findExactTitleMatches(recipeTitle);
        if (!exactMatches.isEmpty()) {
            return exactMatches.get(0);
        }

        List<Long> recipeIds = recipeRepository.searchRecipeIds(
                recipeTitle,
                null,
                null,
                false,
                20.0,
                null,
                null,
                null,
                null
        );

        if (recipeIds.isEmpty()) {
            return null;
        }

        return recipeRepository.findById(recipeIds.get(0)).orElse(null);
    }
}
