package com.student.recipe.dto.assistant;

import java.util.List;

public record AssistantChatResponseDto(
        String answer,
        List<String> quickReplies,
        AssistantRecipePreviewDto recipePreview
) {
    public AssistantChatResponseDto(String answer) {
        this(answer, null, null);
    }

    public AssistantChatResponseDto(String answer, List<String> quickReplies) {
        this(answer, quickReplies, null);
    }
}
