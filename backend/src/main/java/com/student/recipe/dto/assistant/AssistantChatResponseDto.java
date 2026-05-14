package com.student.recipe.dto.assistant;

import java.util.List;

public record AssistantChatResponseDto(
        String answer,
        List<String> quickReplies
) {
    public AssistantChatResponseDto(String answer) {
        this(answer, null);
    }
}
