package com.student.recipe.dto;

import java.util.List;

public record AssistantChatResponseDto(
        String answer,
        List<String> warnings,
        List<String> suggestions
) {
}
