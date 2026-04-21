package com.student.recipe.service.assistant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.assistant.AssistantChatResponseDto;
import com.student.recipe.dto.assistant.UserAiProfileContextDto;
import com.student.recipe.vector.DocumentMatch;
import com.student.recipe.vector.EmbeddingVectorService;

@Service
public class AssistantChatService {

    private static final double RELEVANCE_THRESHOLD = 0.75;

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
            """;

    private final OpenAiService openAiService;
    private final UserAiProfileContextService userAiProfileContextService;
    private final UserAiContextPromptBuilder userAiContextPromptBuilder;
    private final EmbeddingVectorService vectorService;

    public AssistantChatService(
            OpenAiService openAiService,
            UserAiProfileContextService userAiProfileContextService,
            UserAiContextPromptBuilder userAiContextPromptBuilder,
            EmbeddingVectorService vectorService
    ) {
        this.openAiService = openAiService;
        this.userAiProfileContextService = userAiProfileContextService;
        this.userAiContextPromptBuilder = userAiContextPromptBuilder;
        this.vectorService = vectorService;
    }

    public AssistantChatResponseDto chat(String userEmail, String message) {
        if (message == null || message.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }

        // 1) Kullanıcı profilini çek
        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);

        // 2) Semantic search
        List<DocumentMatch> matches = vectorService.findRelevant(message.trim(), 5);

        // 3) RAG context oluştur
        String ragContext = buildRagContext(matches);

        // 4) Final prompt
        String systemPrompt = SYSTEM_PROMPT;
        String userPrompt = """
                === USER PROFILE ===
                %s
                
                === RELEVANT RECIPES FROM DATABASE ===
                %s
                
                === USER QUESTION ===
                %s
                
                Answer based on the context above. Tailor the response to the user profile.
                """.formatted(profileContext, ragContext, message.trim());

        String answer = openAiService.chat(systemPrompt, userPrompt);

        return new AssistantChatResponseDto(
                answer,
                List.of("This response is for general informational purposes and does not replace medical advice."),
                List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
        );
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