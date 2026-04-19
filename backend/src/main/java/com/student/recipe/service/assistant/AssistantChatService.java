package com.student.recipe.service.assistant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.assistant.AssistantChatResponseDto;
import com.student.recipe.dto.assistant.UserAiProfileContextDto;

@Service
public class AssistantChatService {

    private static final String SYSTEM_PROMPT = """
            You are a personalized nutrition assistant.
            Respond in English.
            Give practical, actionable, and safe suggestions tailored to the user's context.
            Do not provide medical diagnoses or medication dosage advice.
            If the situation sounds risky or clinically urgent, clearly advise the user to contact a doctor.
            """;

    private final OpenAiService openAiService;
    private final UserAiProfileContextService userAiProfileContextService;
    private final UserAiContextPromptBuilder userAiContextPromptBuilder;

    public AssistantChatService(
            OpenAiService openAiService,
            UserAiProfileContextService userAiProfileContextService,
            UserAiContextPromptBuilder userAiContextPromptBuilder
    ) {
        this.openAiService = openAiService;
        this.userAiProfileContextService = userAiProfileContextService;
        this.userAiContextPromptBuilder = userAiContextPromptBuilder;
    }

    public AssistantChatResponseDto chat(String userEmail, String message) {
        if (message == null || message.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }

        UserAiProfileContextDto context = userAiProfileContextService.buildContext(userEmail);
        String profileContext = userAiContextPromptBuilder.buildProfileParagraph(context);

        String systemPrompt = SYSTEM_PROMPT + "\nUser profile: " + profileContext;
        String prompt = "User question: " + message.trim();

        String answer = openAiService.chat(systemPrompt, prompt);

        return new AssistantChatResponseDto(
                answer,
                List.of("This response is for general informational purposes and does not replace medical advice."),
                List.of("When following these suggestions, prioritize the plan given by your doctor or dietitian.")
        );
    }
}
