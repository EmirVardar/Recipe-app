package com.student.recipe.integration.openai;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OpenAiClient {

    private final RestClient restClient;

    public OpenAiClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder
                .baseUrl("https://api.openai.com")
                .build();
    }

    public ChatCompletionResponse createChatCompletion(String apiKey, ChatCompletionRequest request) {
        return restClient.post()
                .uri("/v1/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(request)
                .retrieve()
                .body(ChatCompletionResponse.class);
    }

    public record ChatCompletionRequest(
            String model,
            List<ChatMessage> messages,
            Double temperature
    ) {
    }

    public record ChatMessage(
            String role,
            String content
    ) {
    }

    public record ChatCompletionResponse(
            List<Choice> choices
    ) {
    }

    public record Choice(
            Integer index,
            ChatMessage message
    ) {
    }
}
