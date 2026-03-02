package com.student.recipe.service.assistant;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.integration.openai.OpenAiClient;

@Service
public class OpenAiService {

    private final OpenAiClient openAiClient;
    private final String apiKey;
    private final String model;

    public OpenAiService(
            OpenAiClient openAiClient,
            @Value("${openai.api-key:}") String apiKey,
            @Value("${openai.chat-model:gpt-4o-mini}") String model
    ) {
        this.openAiClient = openAiClient;
        this.apiKey = apiKey;
        this.model = model;
    }

    public String chat(String systemPrompt, String userPrompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "OPENAI_API_KEY is not configured");
        }

        OpenAiClient.ChatCompletionRequest request = new OpenAiClient.ChatCompletionRequest(
                model,
                List.of(
                        new OpenAiClient.ChatMessage("system", systemPrompt),
                        new OpenAiClient.ChatMessage("user", userPrompt)
                ),
                0.4
        );

        OpenAiClient.ChatCompletionResponse response = openAiClient.createChatCompletion(apiKey, request);

        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI returned an empty response");
        }

        OpenAiClient.ChatMessage message = response.choices().getFirst().message();
        if (message == null || message.content() == null || message.content().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI returned empty message content");
        }

        return message.content();
    }
}
